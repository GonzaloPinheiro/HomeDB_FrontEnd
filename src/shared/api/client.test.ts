import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ApiObjResponse } from '@/shared/types/api'

import { ApiError, api, isRateLimitError, setOnSessionExpired, shouldRetryQuery, toApiError, unwrap } from './client'
import { ApiErrorCodes, getErrorMessage } from './errors'

function envelope<T>(partial: Partial<ApiObjResponse<T>>): ApiObjResponse<T> {
  return { result: true, data: null, errorCode: null, errorMessage: null, ...partial }
}

describe('unwrap (envelope ApiObjResponse, CLAUDE.md §5.1)', () => {
  it('devuelve data cuando result es true', () => {
    const response = envelope<{ id: number }>({ result: true, data: { id: 3 } })
    expect(unwrap(response)).toEqual({ id: 3 })
  })

  it('lanza ApiError con el mensaje mapeado cuando result es false y el código es conocido', () => {
    const response = envelope({
      result: false,
      errorCode: ApiErrorCodes.InvalidCredentials,
      errorMessage: 'Invalid credentials',
    })
    try {
      unwrap(response)
      expect.unreachable('unwrap debería haber lanzado')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).errorCode).toBe(1006)
      // El código conocido usa siempre su mensaje específico en español,
      // nunca el errorMessage crudo del backend
      expect((error as ApiError).message).toBe('Usuario o contraseña incorrectos')
    }
  })

  it('usa el errorMessage del backend como fallback para códigos desconocidos', () => {
    const response = envelope({ result: false, errorCode: 4242, errorMessage: 'Mensaje del backend' })
    expect(() => unwrap(response)).toThrowError('Mensaje del backend')
  })
})

describe('toApiError', () => {
  it('extrae el envelope del body de un AxiosError', () => {
    const axiosError = new AxiosError('Request failed with status code 401')
    axiosError.response = {
      data: envelope({ result: false, errorCode: ApiErrorCodes.InvalidCredentials, errorMessage: 'x' }),
    } as never
    const apiError = toApiError(axiosError)
    expect(apiError.errorCode).toBe(1006)
    expect(apiError.message).toBe('Usuario o contraseña incorrectos')
  })

  it('devuelve el mismo ApiError si ya lo es', () => {
    const original = new ApiError(1001, 'x')
    expect(toApiError(original)).toBe(original)
  })

  it('normaliza errores de red (sin envelope) al mensaje genérico', () => {
    const apiError = toApiError(new AxiosError('Network Error'))
    expect(apiError.errorCode).toBeNull()
    expect(apiError.message).toBe(getErrorMessage(null))
  })
})

describe('rate limit (429)', () => {
  function rateLimitResponse(headers: Record<string, string>, body: unknown) {
    const axiosError = new AxiosError('Request failed with status code 429')
    axiosError.response = { status: 429, data: body, headers } as never
    return axiosError
  }

  it('conserva el estado HTTP y lee Retry-After en segundos', () => {
    const apiError = toApiError(
      rateLimitResponse(
        { 'retry-after': '60' },
        envelope({ result: false, errorCode: ApiErrorCodes.RateLimitExceeded, errorMessage: 'x' }),
      ),
    )
    expect(apiError.httpStatus).toBe(429)
    expect(apiError.retryAfterMs).toBe(60_000)
    expect(isRateLimitError(apiError)).toBe(true)
  })

  it('detecta un 429 sin envelope (proxy) por el estado HTTP, y deja retryAfterMs a null si no hay cabecera', () => {
    const apiError = toApiError(rateLimitResponse({}, 'Too Many Requests'))
    expect(apiError.errorCode).toBeNull()
    expect(apiError.retryAfterMs).toBeNull()
    expect(isRateLimitError(apiError)).toBe(true)
  })

  it('un error de red sin respuesta no es rate limit', () => {
    expect(isRateLimitError(toApiError(new AxiosError('Network Error')))).toBe(false)
  })
})

describe('shouldRetryQuery', () => {
  function httpError(status: number) {
    const error = new AxiosError(`status ${status}`)
    error.response = { status } as never
    return error
  }

  it('no reintenta respuestas 4xx (403, 404, 429...)', () => {
    for (const status of [400, 403, 404, 429]) {
      expect(shouldRetryQuery(0, httpError(status))).toBe(false)
    }
  })

  it('reintenta fallos transitorios (red caída, 5xx) hasta 3 veces', () => {
    expect(shouldRetryQuery(0, new AxiosError('Network Error'))).toBe(true)
    expect(shouldRetryQuery(2, httpError(503))).toBe(true)
    expect(shouldRetryQuery(3, httpError(503))).toBe(false)
  })
})

describe('interceptor de 401 (CLAUDE.md §5.2)', () => {
  const originalAdapter = api.defaults.adapter

  afterEach(() => {
    api.defaults.adapter = originalAdapter
    setOnSessionExpired(null)
  })

  function respond(config: InternalAxiosRequestConfig, status: number, data: unknown = {}) {
    const response = { data, status, statusText: '', headers: {}, config }
    if (status >= 400) throw new AxiosError(`status ${status}`, undefined, config, null, response)
    return response
  }

  // Simula un backend con access token caducado hasta que se llama a refreshToken
  function installBackend(options: { refreshFails?: boolean; dataStatus?: number } = {}) {
    let refreshed = false
    const refreshCalls = vi.fn()
    const adapter: AxiosAdapter = async (config) => {
      if (config.url?.includes('/auth/refreshToken')) {
        refreshCalls()
        await new Promise((resolve) => setTimeout(resolve, 5))
        if (options.refreshFails) return respond(config, 401)
        refreshed = true
        return respond(config, 200)
      }
      if (!refreshed) return respond(config, 401)
      return respond(config, options.dataStatus ?? 200, { ok: true })
    }
    api.defaults.adapter = adapter
    return { refreshCalls }
  }

  it('varias peticiones 401 simultáneas comparten UN solo refresh (el refresh token rota)', async () => {
    const { refreshCalls } = installBackend()
    const results = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')])
    expect(results.every((r) => r.status === 200)).toBe(true)
    expect(refreshCalls).toHaveBeenCalledTimes(1)
  })

  it('si el refresh falla, expira la sesión local', async () => {
    installBackend({ refreshFails: true })
    const onExpired = vi.fn()
    setOnSessionExpired(onExpired)
    await expect(api.get('/a')).rejects.toBeInstanceOf(AxiosError)
    expect(onExpired).toHaveBeenCalledTimes(1)
  })

  it('si el refresh va bien pero la petición reintentada falla por otro motivo, NO expira la sesión', async () => {
    installBackend({ dataStatus: 403 })
    const onExpired = vi.fn()
    setOnSessionExpired(onExpired)
    await expect(api.get('/a')).rejects.toMatchObject({ response: { status: 403 } })
    expect(onExpired).not.toHaveBeenCalled()
  })
})

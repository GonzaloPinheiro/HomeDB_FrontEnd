import { AxiosError } from 'axios'
import { describe, expect, it } from 'vitest'

import type { ApiObjResponse } from '@/shared/types/api'

import { ApiError, toApiError, unwrap } from './client'
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

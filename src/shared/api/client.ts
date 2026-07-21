import axios, { AxiosError, type AxiosRequestConfig } from 'axios'

import { env } from '@/shared/env'
import type { ApiObjResponse } from '@/shared/types/api'

import { getErrorMessage } from './errors'

/** Error tipado de la API: código del backend + mensaje ya mapeado (errors.ts). */
export class ApiError extends Error {
  readonly errorCode: number | null

  constructor(errorCode: number | null, message: string) {
    super(message)
    this.name = 'ApiError'
    this.errorCode = errorCode
  }
}

// CLAUDE.md §5.2: la auth va por cookies httpOnly — withCredentials siempre,
// nunca un header Authorization manual.
export const api = axios.create({
  baseURL: `${env.VITE_API_URL}/api`,
  withCredentials: true,
})

// Registrado por el AuthProvider: limpia el estado local y navega a /login con
// el router (nunca window.location, §5.2). Vive como callback porque este módulo
// no es un componente y no puede usar useNavigate.
let onSessionExpired: (() => void) | null = null

export function setOnSessionExpired(callback: (() => void) | null): void {
  onSessionExpired = callback
}

type RetriableConfig = AxiosRequestConfig & { _retried?: boolean }

// CLAUDE.md §5.2: en un 401 que no venga de login/refresh, refrescar UNA vez
// (la cookie viaja sola) y reintentar la request original; si el refresh también
// falla, expirar la sesión local.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined
    const url = config?.url ?? ''
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/refreshToken')

    if (error.response?.status === 401 && config && !isAuthEndpoint && !config._retried) {
      config._retried = true
      try {
        await api.post('/auth/refreshToken', { refreshToken: '' })
        return await api(config)
      } catch {
        onSessionExpired?.()
      }
    }

    return Promise.reject(error)
  },
)

/**
 * Desenvuelve el envelope ApiObjResponse<T> (§5.1). Si result es false, lanza
 * ApiError con el mensaje ya mapeado del diccionario de errores.
 */
export function unwrap<T>(response: ApiObjResponse<T>): T {
  if (!response.result) {
    throw new ApiError(response.errorCode, getErrorMessage(response.errorCode, response.errorMessage))
  }
  return response.data as T
}

function isEnvelope(data: unknown): data is ApiObjResponse<unknown> {
  return typeof data === 'object' && data !== null && typeof (data as ApiObjResponse<unknown>).result === 'boolean'
}

/**
 * Normaliza cualquier error (AxiosError con envelope en el body, ApiError ya
 * lanzado por unwrap, o error de red) a un ApiError con mensaje mapeado.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isAxiosError(error) && isEnvelope(error.response?.data)) {
    const envelope = error.response.data
    return new ApiError(envelope.errorCode, getErrorMessage(envelope.errorCode, envelope.errorMessage))
  }
  return new ApiError(null, getErrorMessage(null))
}

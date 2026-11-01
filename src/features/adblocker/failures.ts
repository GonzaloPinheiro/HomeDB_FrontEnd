import { isRateLimitError, toApiError } from '@/shared/api/client'
import { ApiErrorCodes } from '@/shared/api/errors'

import { ADBLOCKER_ERROR_CODES } from './types'

// CLAUDE.md §6.21: por qué ha fallado la carga de la pantalla y qué se le dice al usuario.

export type AdBlockerFailureKind =
  | 'notConfigured'
  | 'invalidCredentials'
  | 'unreachable'
  | 'forbidden'
  | 'rateLimited'
  | 'other'

export function getAdBlockerFailure(error: unknown): AdBlockerFailureKind {
  const apiError = toApiError(error)
  // El 429 va primero: puede llegar de un proxy sin envelope (sin `errorCode`)
  if (isRateLimitError(apiError)) return 'rateLimited'
  switch (apiError.errorCode) {
    case ADBLOCKER_ERROR_CODES.NotConfigured:
      return 'notConfigured'
    case ADBLOCKER_ERROR_CODES.InvalidCredentials:
      return 'invalidCredentials'
    case ADBLOCKER_ERROR_CODES.Unreachable:
      return 'unreachable'
    case ApiErrorCodes.Unauthorized:
      return 'forbidden'
    default:
      return 'other'
  }
}

/**
 * Los cuatro primeros son deterministas (reintentar no los arregla): no se reintentan.
 * El resto se rige por el predicado por defecto de la app (red caída y 5xx, §5.1).
 */
export function isDeterministicFailure(kind: AdBlockerFailureKind): boolean {
  return kind !== 'other' && kind !== 'rateLimited'
}

export type FailureView = {
  /** Línea pequeña en mayúsculas sobre el título. */
  label: string
  title: string
  body: string
  /** Warning (falta algo por configurar) o Critical (algo falla). */
  tone: 'warning' | 'critical'
  /** Solo tiene sentido reintentar si el problema puede resolverse solo. */
  canRetry: boolean
}

export const FAILURE_VIEWS: Record<Exclude<AdBlockerFailureKind, 'other'>, FailureView> = {
  notConfigured: {
    label: 'Integración no configurada',
    title: 'AdGuard todavía no está conectado',
    body: 'HomeDB no tiene la dirección ni las credenciales de AdGuard Home. Añádelas en la configuración del servidor de HomeDB y reinícialo; esta sección se activará sola.',
    tone: 'warning',
    canRetry: false,
  },
  invalidCredentials: {
    label: 'Credenciales inválidas',
    title: 'AdGuard rechaza las credenciales',
    body: 'El usuario o la contraseña de AdGuard Home guardados en la configuración de HomeDB ya no son válidos. Corrígelos allí y reinicia HomeDB.',
    tone: 'critical',
    canRetry: false,
  },
  unreachable: {
    label: 'Sin conexión',
    title: 'No se puede contactar con AdGuard Home',
    body: 'HomeDB no recibe respuesta de AdGuard. Comprueba que el servicio está en marcha en la Raspberry Pi.',
    tone: 'critical',
    canRetry: true,
  },
  forbidden: {
    label: '403 · Sin acceso',
    title: 'Esta sección es solo para administradores',
    body: 'Tu usuario no tiene el rol Admin, así que no puedes ver ni cambiar la configuración de AdGuard.',
    tone: 'critical',
    canRetry: false,
  },
  rateLimited: {
    label: '429 · Demasiadas peticiones',
    title: 'El servidor está limitando las consultas',
    body: 'Se han hecho demasiadas peticiones en poco tiempo. Espera unos segundos y vuelve a intentarlo.',
    tone: 'warning',
    canRetry: true,
  },
}

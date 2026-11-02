import { isRateLimitError, toApiError } from '@/shared/api/client'
import { ApiErrorCodes } from '@/shared/api/errors'

import { VPN_ERROR_CODES } from './types'

// CLAUDE.md §6.22: por qué ha fallado la carga de la pantalla y qué se le dice al usuario.

export type VpnFailureKind = 'unavailable' | 'forbidden' | 'rateLimited' | 'other'

export function getVpnFailure(error: unknown): VpnFailureKind {
  const apiError = toApiError(error)
  // El 429 va primero: puede llegar de un proxy sin envelope (sin `errorCode`)
  if (isRateLimitError(apiError)) return 'rateLimited'
  switch (apiError.errorCode) {
    case VPN_ERROR_CODES.Unavailable:
      return 'unavailable'
    case ApiErrorCodes.Unauthorized:
      return 'forbidden'
    default:
      return 'other'
  }
}

/**
 * Sin lectura de WireGuard y sin acceso no se arreglan reintentando al instante: se enseñan ya
 * en vez de tras tres reintentos (ya hay un botón "Reintentar" y la pantalla se vuelve a pedir
 * sola cada minuto). El resto se rige por el predicado por defecto de la app (red caída y 5xx, §5.1).
 */
export function isDeterministicFailure(kind: VpnFailureKind): boolean {
  return kind === 'unavailable' || kind === 'forbidden'
}

export type VpnFailureView = {
  /** Línea pequeña en mayúsculas sobre el título. */
  label: string
  title: string
  body: string
  tone: 'warning' | 'critical'
  canRetry: boolean
}

export const VPN_FAILURE_VIEWS: Record<Exclude<VpnFailureKind, 'other'>, VpnFailureView> = {
  unavailable: {
    label: 'No disponible',
    title: 'No se pudieron leer los datos de la VPN',
    body: 'HomeDB no ha podido leer el estado de WireGuard en la Raspberry Pi. Comprueba que el servicio está en marcha y vuelve a intentarlo.',
    tone: 'critical',
    canRetry: true,
  },
  forbidden: {
    label: '403 · Sin acceso',
    title: 'Sin acceso a esta sección',
    body: 'La gestión de la VPN solo está disponible para el rol Admin. Si necesitas revisar tus dispositivos, pide acceso a un administrador.',
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

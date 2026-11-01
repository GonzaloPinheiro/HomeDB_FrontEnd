import { describe, expect, it } from 'vitest'

import { ApiError } from '@/shared/api/client'
import { ApiErrorCodes } from '@/shared/api/errors'

import { VPN_FAILURE_VIEWS, getVpnFailure, isDeterministicFailure } from './failures'
import { VPN_ERROR_CODES } from './types'

describe('getVpnFailure', () => {
  it('reconoce el código propio de la integración', () => {
    expect(getVpnFailure(new ApiError(VPN_ERROR_CODES.Unavailable, 'x', { httpStatus: 500 }))).toBe('unavailable')
  })

  it('403 Unauthorized es "forbidden"', () => {
    expect(getVpnFailure(new ApiError(ApiErrorCodes.Unauthorized, 'x', { httpStatus: 403 }))).toBe('forbidden')
  })

  it('un 429 es "rateLimited" tanto por código 1009 como por estado HTTP sin envelope', () => {
    expect(getVpnFailure(new ApiError(ApiErrorCodes.RateLimitExceeded, 'x'))).toBe('rateLimited')
    expect(getVpnFailure(new ApiError(null, 'x', { httpStatus: 429 }))).toBe('rateLimited')
  })

  it('cualquier otra cosa es "other"', () => {
    expect(getVpnFailure(new ApiError(null, 'sin red'))).toBe('other')
    expect(getVpnFailure(new ApiError(ApiErrorCodes.InternalError, 'x', { httpStatus: 500 }))).toBe('other')
    expect(getVpnFailure(new Error('boom'))).toBe('other')
  })
})

describe('isDeterministicFailure', () => {
  it('sin lectura y sin acceso no se reintentan solos; el 429 y lo genérico siguen la política por defecto', () => {
    expect(isDeterministicFailure('unavailable')).toBe(true)
    expect(isDeterministicFailure('forbidden')).toBe(true)
    expect(isDeterministicFailure('rateLimited')).toBe(false)
    expect(isDeterministicFailure('other')).toBe(false)
  })
})

describe('VPN_FAILURE_VIEWS', () => {
  it('solo ofrece "Reintentar" cuando el problema puede resolverse solo', () => {
    expect(VPN_FAILURE_VIEWS.unavailable.canRetry).toBe(true)
    expect(VPN_FAILURE_VIEWS.rateLimited.canRetry).toBe(true)
    expect(VPN_FAILURE_VIEWS.forbidden.canRetry).toBe(false)
  })
})

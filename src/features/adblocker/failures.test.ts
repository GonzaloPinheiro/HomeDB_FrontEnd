import { describe, expect, it } from 'vitest'

import { ApiError } from '@/shared/api/client'
import { ApiErrorCodes } from '@/shared/api/errors'

import { FAILURE_VIEWS, getAdBlockerFailure, isDeterministicFailure } from './failures'
import { ADBLOCKER_ERROR_CODES } from './types'

describe('getAdBlockerFailure', () => {
  it('reconoce los códigos propios de la integración', () => {
    expect(getAdBlockerFailure(new ApiError(ADBLOCKER_ERROR_CODES.NotConfigured, 'x'))).toBe('notConfigured')
    expect(getAdBlockerFailure(new ApiError(ADBLOCKER_ERROR_CODES.InvalidCredentials, 'x'))).toBe('invalidCredentials')
    expect(getAdBlockerFailure(new ApiError(ADBLOCKER_ERROR_CODES.Unreachable, 'x'))).toBe('unreachable')
  })

  it('403 Unauthorized es "forbidden"', () => {
    expect(getAdBlockerFailure(new ApiError(ApiErrorCodes.Unauthorized, 'x', { httpStatus: 403 }))).toBe('forbidden')
  })

  it('un 429 es "rateLimited" tanto por código 1009 como por estado HTTP sin envelope', () => {
    expect(getAdBlockerFailure(new ApiError(ApiErrorCodes.RateLimitExceeded, 'x'))).toBe('rateLimited')
    expect(getAdBlockerFailure(new ApiError(null, 'x', { httpStatus: 429 }))).toBe('rateLimited')
  })

  it('cualquier otra cosa (red caída, 500, errores no ApiError) es "other"', () => {
    expect(getAdBlockerFailure(new ApiError(null, 'sin red'))).toBe('other')
    expect(getAdBlockerFailure(new ApiError(ApiErrorCodes.InternalError, 'x', { httpStatus: 500 }))).toBe('other')
    expect(getAdBlockerFailure(new Error('boom'))).toBe('other')
    expect(getAdBlockerFailure('texto suelto')).toBe('other')
  })
})

describe('isDeterministicFailure', () => {
  it('no se reintenta lo que reintentando no se arregla', () => {
    expect(isDeterministicFailure('notConfigured')).toBe(true)
    expect(isDeterministicFailure('invalidCredentials')).toBe(true)
    expect(isDeterministicFailure('unreachable')).toBe(true)
    expect(isDeterministicFailure('forbidden')).toBe(true)
  })

  it('el 429 y los errores genéricos siguen la política de reintentos por defecto', () => {
    expect(isDeterministicFailure('rateLimited')).toBe(false)
    expect(isDeterministicFailure('other')).toBe(false)
  })
})

describe('FAILURE_VIEWS', () => {
  it('solo ofrece "Reintentar" cuando el problema puede resolverse solo', () => {
    expect(FAILURE_VIEWS.notConfigured.canRetry).toBe(false)
    expect(FAILURE_VIEWS.invalidCredentials.canRetry).toBe(false)
    expect(FAILURE_VIEWS.forbidden.canRetry).toBe(false)
    expect(FAILURE_VIEWS.unreachable.canRetry).toBe(true)
    expect(FAILURE_VIEWS.rateLimited.canRetry).toBe(true)
  })

  it('el texto de credenciales no menciona un "401": sería confundible con la sesión de HomeDB', () => {
    expect(JSON.stringify(FAILURE_VIEWS.invalidCredentials)).not.toContain('401')
  })
})

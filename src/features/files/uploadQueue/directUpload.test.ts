import { describe, expect, it } from 'vitest'

import { ApiError } from '@/shared/api/client'
import { ApiErrorCodes } from '@/shared/api/errors'

import {
  DIRECT_UPLOAD_MAX_BYTES,
  UNCERTAIN_OUTCOME_MESSAGE,
  isOutcomeUncertain,
  uploadKindOf,
} from './directUpload'
import { BACKEND_CHUNK_REQUEST_LIMIT_BYTES, CHUNK_SIZE_BYTES, computeChunkPlan } from './pipeline'

describe('DIRECT_UPLOAD_MAX_BYTES', () => {
  it('nunca supera un chunk: lo que no cabe en un chunk tampoco va en una sola petición', () => {
    expect(DIRECT_UPLOAD_MAX_BYTES).toBeLessThanOrEqual(CHUNK_SIZE_BYTES)
    expect(DIRECT_UPLOAD_MAX_BYTES).toBeLessThan(BACKEND_CHUNK_REQUEST_LIMIT_BYTES)
  })

  it('todo archivo directo es de UN solo chunk (así la ruta por sesión nunca necesita más de uno para él)', () => {
    expect(computeChunkPlan(DIRECT_UPLOAD_MAX_BYTES).totalChunks).toBe(1)
  })
})

describe('uploadKindOf', () => {
  it('el límite exacto es directo; un byte más va por sesión', () => {
    expect(uploadKindOf(DIRECT_UPLOAD_MAX_BYTES)).toBe('direct')
    expect(uploadKindOf(DIRECT_UPLOAD_MAX_BYTES + 1)).toBe('chunked')
  })

  it('un archivo pequeño es directo', () => {
    expect(uploadKindOf(1)).toBe('direct')
    expect(uploadKindOf(5 * 1024 * 1024)).toBe('direct')
  })

  it('un archivo grande va por sesión', () => {
    expect(uploadKindOf(10 * 1024 * 1024 * 1024)).toBe('chunked')
  })
})

describe('isOutcomeUncertain — ¿pudo el archivo crearse aunque la petición fallara?', () => {
  it('sin respuesta (red caída, stall, timeout, respuesta ilegible): incierto', () => {
    expect(isOutcomeUncertain(new ApiError(null, 'red'))).toBe(true)
  })

  it('cualquier 5xx: incierto, el servidor pudo guardar y fallar después (con o sin envelope)', () => {
    expect(isOutcomeUncertain(new ApiError(ApiErrorCodes.InternalError, 'x', { httpStatus: 500 }))).toBe(true)
    expect(isOutcomeUncertain(new ApiError(null, 'proxy', { httpStatus: 502 }))).toBe(true)
    expect(isOutcomeUncertain(new ApiError(null, 'proxy', { httpStatus: 504 }))).toBe(true)
  })

  it('un rechazo claro (4xx) es definitivo: no se creó nada', () => {
    for (const [code, httpStatus] of [
      [ApiErrorCodes.FileTooLarge, 413],
      [ApiErrorCodes.StorageLimitExceeded, 413],
      [ApiErrorCodes.InvalidFileExtension, 400],
      [ApiErrorCodes.FolderNotFound, 404],
      [ApiErrorCodes.Unauthorized, 403],
    ] as const) {
      expect(isOutcomeUncertain(new ApiError(code, 'x', { httpStatus }))).toBe(false)
    }
  })

  it('un `result: false` con código (sin estado HTTP) es una respuesta explícita: definitivo', () => {
    expect(isOutcomeUncertain(new ApiError(ApiErrorCodes.FileTooLarge, 'x'))).toBe(false)
  })

  it('el 429 no es incierto (se trata aparte, con la pausa global)', () => {
    expect(isOutcomeUncertain(new ApiError(ApiErrorCodes.RateLimitExceeded, 'x', { httpStatus: 429 }))).toBe(false)
  })
})

describe('UNCERTAIN_OUTCOME_MESSAGE', () => {
  it('avisa de que puede estar ya subido y manda a revisar la carpeta', () => {
    expect(UNCERTAIN_OUTCOME_MESSAGE).toMatch(/ya esté en la carpeta/)
  })
})

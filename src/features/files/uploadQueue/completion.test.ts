import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/shared/api/client'
import { ApiErrorCodes } from '@/shared/api/errors'

import type { UploadStatusResponse } from '../types'
import {
  MAX_CONSECUTIVE_POLL_FAILURES,
  MIN_ASSEMBLY_BYTES_PER_SEC,
  PROCESSING_BASE_TIMEOUT_MS,
  ProcessingTimeoutError,
  UploadSessionEndedError,
  pollDelayMs,
  processingTimeoutMs,
  waitForUploadCompletion,
} from './completion'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const FILE = {
  id: 7,
  fileName: 'a.png',
  sizeBytes: 10,
  contentType: 'image/png',
  folderId: null,
  ownerId: 1,
  uploadedAt: '2026-10-18T00:00:00Z',
}

function status(overrides: Partial<UploadStatusResponse>): UploadStatusResponse {
  return {
    sessionId: 's',
    totalChunks: 1,
    receivedChunks: [1],
    status: 'processing',
    file: null,
    errorCode: null,
    ...overrides,
  }
}

const networkError = () => new ApiError(null, 'sin red')
const serverError = () => new ApiError(ApiErrorCodes.InternalError, 'boom', { httpStatus: 500 })

/** Lanza la espera y captura su resultado sin dejar un rechazo sin atender mientras avanzan los timers. */
function startWaiting(
  fetchStatus: () => Promise<UploadStatusResponse>,
  options: { timeoutMs?: number; waitingEntries?: number; signal?: AbortSignal } = {},
) {
  const settled: { value?: UploadStatusResponse; error?: unknown; done: boolean } = { done: false }
  void waitForUploadCompletion({
    fetchStatus,
    signal: options.signal ?? new AbortController().signal,
    timeoutMs: options.timeoutMs ?? 60_000,
    waitingEntries: () => options.waitingEntries ?? 1,
  }).then(
    (value) => Object.assign(settled, { value, done: true }),
    (error: unknown) => Object.assign(settled, { error, done: true }),
  )
  return settled
}

describe('pollDelayMs', () => {
  it('empieza en 1 s y crece hasta el techo de 5 s', () => {
    expect(pollDelayMs(0, 1)).toBe(1000)
    expect(pollDelayMs(1, 1)).toBe(1500)
    expect(pollDelayMs(2, 1)).toBe(2250)
    expect(pollDelayMs(10, 1)).toBe(5000)
  })

  it('se ensancha con muchas entradas esperando para no agotar el rate limit', () => {
    // 20 entradas esperando: ≈ 2 consultas/s en total, una por entrada cada 10 s
    expect(pollDelayMs(10, 20)).toBe(10_000)
    expect(pollDelayMs(0, 20)).toBe(10_000)
  })

  it('nunca supera los 30 s', () => {
    expect(pollDelayMs(0, 10_000)).toBe(30_000)
  })
})

describe('processingTimeoutMs', () => {
  it('suma el plazo base y el tiempo de ensamblar lo propio y lo que había delante a velocidad mínima', () => {
    const tenSeconds = 10 * MIN_ASSEMBLY_BYTES_PER_SEC
    expect(processingTimeoutMs(tenSeconds, 0)).toBe(PROCESSING_BASE_TIMEOUT_MS + 10_000)
    expect(processingTimeoutMs(tenSeconds, tenSeconds)).toBe(PROCESSING_BASE_TIMEOUT_MS + 20_000)
  })

  it('un archivo diminuto sigue teniendo el plazo base', () => {
    expect(processingTimeoutMs(1, 0)).toBeGreaterThanOrEqual(PROCESSING_BASE_TIMEOUT_MS)
  })
})

describe('waitForUploadCompletion', () => {
  it('devuelve el estado completado (con el archivo) tras seguir procesando unas consultas', async () => {
    const fetchStatus = vi
      .fn<() => Promise<UploadStatusResponse>>()
      .mockResolvedValueOnce(status({ status: 'processing' }))
      .mockResolvedValueOnce(status({ status: 'processing' }))
      .mockResolvedValueOnce(status({ status: 'completed', file: FILE }))

    const settled = startWaiting(fetchStatus)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(fetchStatus).toHaveBeenCalledTimes(3)
    expect(settled.value?.file?.id).toBe(7)
  })

  it('no consulta antes de que pase el primer intervalo', async () => {
    const fetchStatus = vi.fn().mockResolvedValue(status({ status: 'completed', file: FILE }))
    startWaiting(fetchStatus)

    await vi.advanceTimersByTimeAsync(999)
    expect(fetchStatus).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchStatus).toHaveBeenCalledTimes(1)
  })

  it('una sesión cancelada lanza UploadSessionEndedError con el código del backend', async () => {
    const fetchStatus = vi
      .fn()
      .mockResolvedValue(status({ status: 'cancelled', errorCode: ApiErrorCodes.InvalidFileExtension }))
    const settled = startWaiting(fetchStatus)
    await vi.advanceTimersByTimeAsync(1000)

    expect(settled.error).toBeInstanceOf(UploadSessionEndedError)
    expect((settled.error as UploadSessionEndedError).errorCode).toBe(ApiErrorCodes.InvalidFileExtension)
    expect(fetchStatus).toHaveBeenCalledTimes(1)
  })

  it('una sesión cancelada sin código se trata como "ya no está activa"', async () => {
    const settled = startWaiting(vi.fn().mockResolvedValue(status({ status: 'cancelled', errorCode: null })))
    await vi.advanceTimersByTimeAsync(1000)

    expect((settled.error as UploadSessionEndedError).errorCode).toBe(ApiErrorCodes.UploadSessionNotActive)
  })

  it('tolera fallos transitorios de red y 5xx si luego vuelve a responder', async () => {
    const fetchStatus = vi
      .fn<() => Promise<UploadStatusResponse>>()
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(serverError())
      .mockResolvedValueOnce(status({ status: 'completed', file: FILE }))

    const settled = startWaiting(fetchStatus)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(settled.value?.status).toBe('completed')
  })

  it('se rinde tras MAX_CONSECUTIVE_POLL_FAILURES fallos de red seguidos', async () => {
    const fetchStatus = vi.fn().mockRejectedValue(networkError())
    const settled = startWaiting(fetchStatus, { timeoutMs: 10 * 60_000 })
    await vi.advanceTimersByTimeAsync(60_000)

    expect(fetchStatus).toHaveBeenCalledTimes(MAX_CONSECUTIVE_POLL_FAILURES)
    expect(settled.error).toBeInstanceOf(ApiError)
    expect((settled.error as ApiError).errorCode).toBeNull() // sin respuesta real: la reintenta sola el evento 'online'
  })

  it('los fallos no consecutivos no se acumulan', async () => {
    const responses: Array<UploadStatusResponse | Error> = []
    for (let i = 0; i < MAX_CONSECUTIVE_POLL_FAILURES * 2; i++) {
      responses.push(i % 2 === 0 ? networkError() : status({ status: 'processing' }))
    }
    responses.push(status({ status: 'completed', file: FILE }))
    const fetchStatus = vi.fn(() => {
      const next = responses.shift()
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next as UploadStatusResponse)
    })

    const settled = startWaiting(fetchStatus, { timeoutMs: 60 * 60_000 })
    await vi.advanceTimersByTimeAsync(10 * 60_000)

    expect(settled.value?.status).toBe('completed')
  })

  it('un 4xx es definitivo: no se reintenta', async () => {
    const notFound = new ApiError(ApiErrorCodes.UploadSessionNotFound, 'x', { httpStatus: 404 })
    const fetchStatus = vi.fn().mockRejectedValue(notFound)
    const settled = startWaiting(fetchStatus)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(fetchStatus).toHaveBeenCalledTimes(1)
    expect((settled.error as ApiError).errorCode).toBe(ApiErrorCodes.UploadSessionNotFound)
  })

  it('lanza ProcessingTimeoutError si la sesión sigue procesándose pasado el plazo', async () => {
    const fetchStatus = vi.fn().mockResolvedValue(status({ status: 'processing' }))
    const settled = startWaiting(fetchStatus, { timeoutMs: 10_000 })
    await vi.advanceTimersByTimeAsync(30_000)

    expect(settled.error).toBeInstanceOf(ProcessingTimeoutError)
  })

  it('cancelar con el signal corta la espera entre consultas', async () => {
    const controller = new AbortController()
    const fetchStatus = vi.fn().mockResolvedValue(status({ status: 'processing' }))
    const settled = startWaiting(fetchStatus, { signal: controller.signal })

    await vi.advanceTimersByTimeAsync(1000) // primera consulta
    controller.abort()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(settled.done).toBe(true)
    expect((settled.error as DOMException).name).toBe('AbortError')
    expect(fetchStatus).toHaveBeenCalledTimes(1)
  })
})

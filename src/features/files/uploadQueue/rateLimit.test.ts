import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/shared/api/client'
import { ApiErrorCodes } from '@/shared/api/errors'

import { DEFAULT_RATE_LIMIT_PAUSE_MS, RateLimitGate, withRateLimitRetry } from './rateLimit'

const rateLimited = () => new ApiError(ApiErrorCodes.RateLimitExceeded, 'x', { httpStatus: 429 })

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('RateLimitGate', () => {
  it('sin pausa activa, wait resuelve al instante', async () => {
    const gate = new RateLimitGate()
    await expect(gate.wait(new AbortController().signal)).resolves.toBeUndefined()
  })

  it('wait no resuelve hasta que pasa la pausa', async () => {
    const gate = new RateLimitGate()
    gate.pause(1000)
    let resolved = false
    void gate.wait(new AbortController().signal).then(() => (resolved = true))

    await vi.advanceTimersByTimeAsync(999)
    expect(resolved).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(resolved).toBe(true)
  })

  it('una pausa nueva más corta no acorta la que ya había', () => {
    const gate = new RateLimitGate()
    gate.pause(10_000)
    gate.pause(1_000)
    expect(gate.remainingMs()).toBe(10_000)
  })

  it('acota un Retry-After disparatado', () => {
    const gate = new RateLimitGate()
    gate.pause(24 * 60 * 60 * 1000)
    expect(gate.remainingMs()).toBe(5 * 60_000)
  })

  it('cancelar mientras espera rechaza la espera', async () => {
    const gate = new RateLimitGate()
    gate.pause(60_000)
    const controller = new AbortController()
    const waiting = gate.wait(controller.signal)
    controller.abort()
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('avisa a onPause con el instante de reanudación', () => {
    const onPause = vi.fn()
    const gate = new RateLimitGate(Date.now, onPause)
    gate.pause(2000)
    expect(onPause).toHaveBeenCalledWith(Date.now() + 2000)
  })
})

describe('withRateLimitRetry', () => {
  it('devuelve el resultado sin pausar si no hay 429', async () => {
    const gate = new RateLimitGate()
    const request = vi.fn().mockResolvedValue('ok')
    await expect(withRateLimitRetry(gate, new AbortController().signal, request)).resolves.toBe('ok')
    expect(gate.remainingMs()).toBe(0)
  })

  it('ante un 429 pausa la cola entera y reintenta cuando pasa la pausa', async () => {
    const gate = new RateLimitGate()
    const request = vi.fn().mockRejectedValueOnce(rateLimited()).mockResolvedValue('ok')
    const result = withRateLimitRetry(gate, new AbortController().signal, request)

    await vi.advanceTimersByTimeAsync(0)
    expect(request).toHaveBeenCalledTimes(1)
    expect(gate.remainingMs()).toBe(DEFAULT_RATE_LIMIT_PAUSE_MS)

    await vi.advanceTimersByTimeAsync(DEFAULT_RATE_LIMIT_PAUSE_MS)
    await expect(result).resolves.toBe('ok')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('otra subida que llega durante la pausa espera a que termine antes de lanzar su petición', async () => {
    const gate = new RateLimitGate()
    gate.pause(5000)
    const request = vi.fn().mockResolvedValue('ok')
    const result = withRateLimitRetry(gate, new AbortController().signal, request)

    await vi.advanceTimersByTimeAsync(4999)
    expect(request).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await expect(result).resolves.toBe('ok')
  })

  it('respeta el Retry-After del error si lo trae', async () => {
    const gate = new RateLimitGate()
    const error = new ApiError(ApiErrorCodes.RateLimitExceeded, 'x', { httpStatus: 429, retryAfterMs: 7000 })
    const request = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('ok')
    void withRateLimitRetry(gate, new AbortController().signal, request)
    await vi.advanceTimersByTimeAsync(0)
    expect(gate.remainingMs()).toBe(7000)
  })

  it('reconoce un 429 sin envelope (proxy) por el estado HTTP', async () => {
    const gate = new RateLimitGate()
    const axiosError = new AxiosError('Too Many Requests')
    axiosError.response = { status: 429, data: 'Too Many Requests', headers: {} } as never
    const request = vi.fn().mockRejectedValueOnce(axiosError).mockResolvedValue('ok')
    const result = withRateLimitRetry(gate, new AbortController().signal, request)
    await vi.advanceTimersByTimeAsync(DEFAULT_RATE_LIMIT_PAUSE_MS)
    await expect(result).resolves.toBe('ok')
  })

  it('no reintenta errores que no son de rate limit', async () => {
    const gate = new RateLimitGate()
    const error = new ApiError(ApiErrorCodes.FileTooLarge, 'x', { httpStatus: 413 })
    const request = vi.fn().mockRejectedValue(error)
    await expect(withRateLimitRetry(gate, new AbortController().signal, request)).rejects.toBe(error)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('tras el máximo de pausas seguidas se rinde y propaga el 429', async () => {
    const gate = new RateLimitGate()
    const error = rateLimited()
    const request = vi.fn().mockRejectedValue(error)
    const result = withRateLimitRetry(gate, new AbortController().signal, request, 2)
    const assertion = expect(result).rejects.toBe(error)
    await vi.advanceTimersByTimeAsync(DEFAULT_RATE_LIMIT_PAUSE_MS * 3)
    await assertion
    expect(request).toHaveBeenCalledTimes(3) // intento inicial + 2 tras pausa
  })
})

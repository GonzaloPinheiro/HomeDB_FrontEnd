import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMediaRetry } from './useMediaRetry'

const get = vi.hoisted(() => vi.fn())
vi.mock('@/shared/api/client', () => ({ api: { get } }))

describe('useMediaRetry', () => {
  beforeEach(() => {
    get.mockReset()
    get.mockResolvedValue({})
  })

  it('el primer fallo reintenta solo, tras revalidar la sesión, sin mostrar error', async () => {
    const { result } = renderHook(() => useMediaRetry())
    expect(result.current.attempt).toBe(0)

    act(() => result.current.onError())
    await waitFor(() => expect(result.current.attempt).toBe(1))
    expect(get).toHaveBeenCalledTimes(1)
    expect(result.current.failed).toBe(false)
  })

  it('el segundo fallo muestra el error y NO reintenta otra vez por su cuenta', async () => {
    const { result } = renderHook(() => useMediaRetry())
    act(() => result.current.onError())
    await waitFor(() => expect(result.current.attempt).toBe(1))

    act(() => result.current.onError())
    expect(result.current.failed).toBe(true)
    expect(result.current.attempt).toBe(1)
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('"Reintentar" quita el error, revalida y remonta el elemento', async () => {
    const { result } = renderHook(() => useMediaRetry())
    act(() => result.current.onError())
    await waitFor(() => expect(result.current.attempt).toBe(1))
    act(() => result.current.onError())
    expect(result.current.failed).toBe(true)

    await act(() => result.current.retry())
    expect(result.current.failed).toBe(false)
    expect(result.current.attempt).toBe(2)
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('si la revalidación de la sesión falla, el reintento del medio se hace igualmente', async () => {
    get.mockRejectedValue(new Error('red caída'))
    const { result } = renderHook(() => useMediaRetry())
    act(() => result.current.onError())
    await waitFor(() => expect(result.current.attempt).toBe(1))
    expect(result.current.failed).toBe(false)
  })
})

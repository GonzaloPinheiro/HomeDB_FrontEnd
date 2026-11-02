import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDebouncedField } from './useDebouncedField'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useDebouncedField', () => {
  it('arranca con el valor inicial', () => {
    const { result } = renderHook(() => useDebouncedField('abc', vi.fn()))
    expect(result.current.value).toBe('abc')
  })

  it('el texto visible cambia al instante pero commit espera al retardo', () => {
    const commit = vi.fn()
    const { result } = renderHook(() => useDebouncedField('', commit, 300))

    act(() => result.current.onChange('ab'))
    expect(result.current.value).toBe('ab')
    expect(commit).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(299))
    expect(commit).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(commit).toHaveBeenCalledExactlyOnceWith('ab')
  })

  it('escribir de nuevo reinicia el retardo y solo confirma el último valor', () => {
    const commit = vi.fn()
    const { result } = renderHook(() => useDebouncedField('', commit, 300))

    act(() => result.current.onChange('a'))
    act(() => vi.advanceTimersByTime(200))
    act(() => result.current.onChange('ab'))
    act(() => vi.advanceTimersByTime(200))
    expect(commit).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(100))

    expect(commit).toHaveBeenCalledExactlyOnceWith('ab')
  })

  it('reset cambia el texto desde fuera y cancela el commit pendiente (no pisa el cambio programático)', () => {
    const commit = vi.fn()
    const { result } = renderHook(() => useDebouncedField('', commit, 300))

    act(() => result.current.onChange('antiguo'))
    act(() => result.current.reset('GetFilesAsync()'))
    act(() => vi.advanceTimersByTime(1000))

    expect(result.current.value).toBe('GetFilesAsync()')
    expect(commit).not.toHaveBeenCalled()
  })

  it('usa siempre el último commit recibido, no el del primer render', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { result, rerender } = renderHook(({ commit }) => useDebouncedField('', commit, 300), {
      initialProps: { commit: first },
    })

    act(() => result.current.onChange('x'))
    rerender({ commit: second })
    act(() => vi.advanceTimersByTime(300))

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledExactlyOnceWith('x')
  })

  it('al desmontar no confirma nada pendiente', () => {
    const commit = vi.fn()
    const { result, unmount } = renderHook(() => useDebouncedField('', commit, 300))

    act(() => result.current.onChange('x'))
    unmount()
    act(() => vi.advanceTimersByTime(1000))

    expect(commit).not.toHaveBeenCalled()
  })
})

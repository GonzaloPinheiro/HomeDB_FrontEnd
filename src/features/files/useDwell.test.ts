import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDwell } from './useDwell'

describe('useDwell (CLAUDE.md §6.3: navegar al mantener encima ~800ms)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('dispara el callback al cumplirse el plazo sobre el mismo objetivo', () => {
    const onDwell = vi.fn()
    renderHook(() => useDwell('crumb-1', onDwell, 800))
    vi.advanceTimersByTime(799)
    expect(onDwell).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onDwell).toHaveBeenCalledExactlyOnceWith('crumb-1')
  })

  it('se cancela si el objetivo desaparece antes del plazo (soltar o salir de encima)', () => {
    const onDwell = vi.fn()
    const { rerender } = renderHook(({ key }: { key: string | null }) => useDwell(key, onDwell, 800), {
      initialProps: { key: 'crumb-1' as string | null },
    })
    vi.advanceTimersByTime(500)
    rerender({ key: null })
    vi.advanceTimersByTime(1000)
    expect(onDwell).not.toHaveBeenCalled()
  })

  it('cambiar de objetivo reinicia el temporizador', () => {
    const onDwell = vi.fn()
    const { rerender } = renderHook(({ key }: { key: string | null }) => useDwell(key, onDwell, 800), {
      initialProps: { key: 'crumb-1' as string | null },
    })
    vi.advanceTimersByTime(700)
    rerender({ key: 'crumb-2' })
    vi.advanceTimersByTime(700)
    expect(onDwell).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(onDwell).toHaveBeenCalledExactlyOnceWith('crumb-2')
  })
})

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useViewMode } from './useViewMode'
import { VIEW_MODE_KEY } from './viewMode'

describe('useViewMode', () => {
  afterEach(() => localStorage.clear())

  it('arranca en lista y al cambiar recuerda el modo para la próxima visita', () => {
    const first = renderHook(() => useViewMode())
    expect(first.result.current[0]).toBe('list')

    act(() => first.result.current[1]('grid'))
    expect(first.result.current[0]).toBe('grid')
    expect(localStorage.getItem(VIEW_MODE_KEY)).toBe('grid')

    // "Otra visita": un montaje nuevo lee lo guardado
    first.unmount()
    const second = renderHook(() => useViewMode())
    expect(second.result.current[0]).toBe('grid')
  })
})

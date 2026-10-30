import { describe, expect, it } from 'vitest'

import { resolveListLayout } from './layout'

describe('resolveListLayout', () => {
  it('sin panel: tabla desde lg', () => {
    expect(resolveListLayout({ panelOpen: false, isLg: true, isXl: false })).toBe('wide')
    expect(resolveListLayout({ panelOpen: false, isLg: false, isXl: false })).toBe('compact')
  })

  it('con panel al lado: la lista pierde 340px, así que la tabla solo cabe desde xl', () => {
    expect(resolveListLayout({ panelOpen: true, isLg: true, isXl: false })).toBe('compact')
    expect(resolveListLayout({ panelOpen: true, isLg: true, isXl: true })).toBe('wide')
  })

  it('por debajo de lg siempre compact', () => {
    expect(resolveListLayout({ panelOpen: true, isLg: false, isXl: false })).toBe('compact')
  })
})

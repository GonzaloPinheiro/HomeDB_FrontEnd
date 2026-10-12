import { describe, expect, it } from 'vitest'

import { formatInteger } from './formatNumber'

describe('formatInteger', () => {
  it('agrupa miles también con 4 cifras', () => {
    expect(formatInteger(1284)).toBe('1.284')
    expect(formatInteger(2481503)).toBe('2.481.503')
  })

  it('números pequeños sin separador y cero', () => {
    expect(formatInteger(42)).toBe('42')
    expect(formatInteger(0)).toBe('0')
  })

  it('valor no finito', () => {
    expect(formatInteger(Number.NaN)).toBe('—')
  })
})

import { describe, expect, it } from 'vitest'

import { wireEnum } from './wireEnum'

type Color = 'red' | 'blue'

const colorSchema = wireEnum<Color>({ '1': 'red', Red: 'red', '2': 'blue', Blue: 'blue' })

describe('wireEnum', () => {
  it('normaliza el valor numérico del wire', () => {
    expect(colorSchema.parse(1)).toBe('red')
    expect(colorSchema.parse(2)).toBe('blue')
  })

  it('acepta el nombre como string por tolerancia', () => {
    expect(colorSchema.parse('Red')).toBe('red')
    expect(colorSchema.parse('Blue')).toBe('blue')
  })

  it('rechaza un valor que el front no conoce', () => {
    expect(colorSchema.safeParse(99).success).toBe(false)
    expect(colorSchema.safeParse('Green').success).toBe(false)
    expect(colorSchema.safeParse(null).success).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'

import { getGreeting } from './greeting'

const at = (hour: number, minute = 0) => new Date(2026, 7, 25, hour, minute)

describe('getGreeting', () => {
  it('mañana de 6:00 a 11:59', () => {
    expect(getGreeting(at(6))).toBe('Buenos días')
    expect(getGreeting(at(11, 59))).toBe('Buenos días')
  })

  it('tarde de 12:00 a 19:59', () => {
    expect(getGreeting(at(12))).toBe('Buenas tardes')
    expect(getGreeting(at(19, 59))).toBe('Buenas tardes')
  })

  it('noche y madrugada', () => {
    expect(getGreeting(at(20))).toBe('Buenas noches')
    expect(getGreeting(at(0))).toBe('Buenas noches')
    expect(getGreeting(at(5, 59))).toBe('Buenas noches')
  })
})

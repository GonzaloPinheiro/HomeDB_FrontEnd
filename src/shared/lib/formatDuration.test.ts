import { describe, expect, it } from 'vitest'

import { formatDuration } from './formatDuration'

describe('formatDuration', () => {
  it('menos de un minuto -> segundos', () => {
    expect(formatDuration(0)).toBe('0 s')
    expect(formatDuration(45_000)).toBe('45 s')
  })

  it('redondea al segundo más cercano', () => {
    expect(formatDuration(1_400)).toBe('1 s')
    expect(formatDuration(1_600)).toBe('2 s')
  })

  it('minutos y segundos', () => {
    expect(formatDuration(60_000)).toBe('1 min 0 s')
    expect(formatDuration(134_000)).toBe('2 min 14 s')
  })

  it('a partir de una hora -> horas y minutos con cero a la izquierda', () => {
    expect(formatDuration(3_900_000)).toBe('1 h 05 min')
  })

  it('valores inválidos -> guion', () => {
    expect(formatDuration(-1)).toBe('—')
    expect(formatDuration(Number.NaN)).toBe('—')
  })
})

import { describe, expect, it } from 'vitest'

import { formatDuration, formatMillis } from './formatDuration'

describe('formatMillis', () => {
  it('por debajo del segundo -> milisegundos', () => {
    expect(formatMillis(0)).toBe('0 ms')
    expect(formatMillis(850)).toBe('850 ms')
    expect(formatMillis(999)).toBe('999 ms')
  })

  it('un valor que redondea a 1000 ms ya es un segundo, no "1000 ms"', () => {
    expect(formatMillis(999.6)).toBe('1 s')
  })

  it('segundos con un decimal y coma, sin ",0" sobrante', () => {
    expect(formatMillis(1000)).toBe('1 s')
    expect(formatMillis(1500)).toBe('1,5 s')
    expect(formatMillis(2349)).toBe('2,3 s')
    expect(formatMillis(2000)).toBe('2 s')
    expect(formatMillis(59_949)).toBe('59,9 s')
  })

  it('desde un minuto (o al redondear a él) delega en formatDuration', () => {
    expect(formatMillis(59_960)).toBe('1 min 0 s')
    expect(formatMillis(134_000)).toBe('2 min 14 s')
  })

  it('valores inválidos -> guion', () => {
    expect(formatMillis(-1)).toBe('—')
    expect(formatMillis(Number.NaN)).toBe('—')
  })
})

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

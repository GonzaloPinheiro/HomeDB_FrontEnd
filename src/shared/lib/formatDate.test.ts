import { describe, expect, it } from 'vitest'

import { formatDateTime, formatLongDate, formatShortDate, formatShortDateTime, formatTime, formatUtcDay } from './formatDate'

// `now` fijo para que los tests no dependan del año en que se ejecutan
const NOW = new Date('2026-07-21T12:00:00Z')

describe('formatShortDate', () => {
  it('fecha del año en curso: día y mes corto sin año', () => {
    expect(formatShortDate('2026-07-12T10:30:00Z', NOW)).toBe('12 jul')
  })

  it('fecha de otro año: incluye el año', () => {
    expect(formatShortDate('2025-01-05T10:30:00Z', NOW)).toBe('5 ene 2025')
  })

  it('string inválido', () => {
    expect(formatShortDate('no-es-una-fecha', NOW)).toBe('—')
  })
})

describe('formatDateTime', () => {
  it('incluye fecha completa y hora con segundos', () => {
    expect(formatDateTime('2026-07-12T10:30:05Z')).toMatch(/12 jul 2026, \d{2}:\d{2}:\d{2}/)
  })

  it('string inválido', () => {
    expect(formatDateTime('no-es-una-fecha')).toBe('—')
  })
})

describe('formatShortDateTime', () => {
  // La hora depende de la zona horaria del entorno, así que solo se comprueba la forma
  it('año en curso: día, mes corto y hora sin año ni segundos', () => {
    expect(formatShortDateTime('2026-07-12T10:30:05Z', NOW)).toMatch(/^12 jul,? \d{2}:\d{2}$/)
  })

  it('otro año: incluye el año', () => {
    expect(formatShortDateTime('2025-01-05T10:30:05Z', NOW)).toMatch(/^5 ene 2025,? \d{2}:\d{2}$/)
  })

  it('string inválido', () => {
    expect(formatShortDateTime('no-es-una-fecha', NOW)).toBe('—')
  })
})

describe('formatLongDate', () => {
  it('día de la semana capitalizado, día y mes completo', () => {
    // Hora local fija (mediodía) para no depender de la zona horaria del entorno
    expect(formatLongDate(new Date(2026, 7, 25, 12))).toBe('Martes, 25 de agosto')
  })
})

describe('formatTime', () => {
  it('solo hora y minutos, sin fecha ni segundos', () => {
    expect(formatTime('2026-07-12T10:30:05Z')).toMatch(/^\d{2}:\d{2}$/)
  })

  it('string inválido', () => {
    expect(formatTime('no-es-una-fecha')).toBe('—')
  })
})

describe('formatUtcDay', () => {
  it('día UTC legible, con año', () => {
    expect(formatUtcDay('2026-11-01')).toBe('1 nov 2026')
    expect(formatUtcDay('2026-01-31')).toBe('31 ene 2026')
  })

  it('no se desplaza al día anterior por la zona horaria (se formatea en UTC)', () => {
    // 00:00 UTC del 1 de noviembre sigue siendo "1 nov" aunque en América sea todavía 31 de octubre
    expect(formatUtcDay('2026-11-01')).toContain('1 nov')
  })

  it('fecha inválida -> guion', () => {
    expect(formatUtcDay('no-es-una-fecha')).toBe('—')
    expect(formatUtcDay('')).toBe('—')
  })
})

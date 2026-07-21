import { describe, expect, it } from 'vitest'

import { formatShortDate } from './formatDate'

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

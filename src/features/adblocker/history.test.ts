import { describe, expect, it } from 'vitest'

import {
  MAX_CUSTOM_RANGE_DAYS,
  defaultCustomRange,
  formatAxisTick,
  formatCompact,
  formatTooltipTitle,
  niceMax,
  pickAxisTicks,
  resolveHistoryWindow,
  toChartPoints,
} from './history'

const NOW = Date.parse('2026-11-01T12:00:00Z')

describe('resolveHistoryWindow', () => {
  it('los rangos fijos terminan en "ahora"', () => {
    const result = resolveHistoryWindow({ range: '24h', from: '', to: '' }, NOW)
    expect(result).toEqual({
      ok: true,
      window: { from: '2026-10-31T12:00:00.000Z', to: '2026-11-01T12:00:00.000Z' },
    })
    const week = resolveHistoryWindow({ range: '7d', from: '', to: '' }, NOW)
    expect(week.ok && week.window.from).toBe('2026-10-25T12:00:00.000Z')
    const month = resolveHistoryWindow({ range: '30d', from: '', to: '' }, NOW)
    expect(month.ok && month.window.from).toBe('2026-10-02T12:00:00.000Z')
  })

  it('el rango personalizado ancla las fechas a UTC (nunca una fecha "pelada", CLAUDE.md §5.4)', () => {
    const result = resolveHistoryWindow({ range: 'custom', from: '2026-10-01', to: '2026-10-15' }, NOW)
    expect(result).toEqual({ ok: true, window: { from: '2026-10-01T00:00:00Z', to: '2026-10-15T23:59:59Z' } })
  })

  it('acepta un solo día (desde = hasta)', () => {
    expect(resolveHistoryWindow({ range: 'custom', from: '2026-10-05', to: '2026-10-05' }, NOW).ok).toBe(true)
  })

  it('rechaza fechas vacías o invertidas con un mensaje', () => {
    const empty = resolveHistoryWindow({ range: 'custom', from: '', to: '2026-10-15' }, NOW)
    expect(empty).toEqual({ ok: false, message: 'Elige las dos fechas del rango.' })
    const inverted = resolveHistoryWindow({ range: 'custom', from: '2026-10-15', to: '2026-10-01' }, NOW)
    expect(inverted).toEqual({ ok: false, message: 'La fecha final debe ser igual o posterior a la inicial.' })
  })

  it(`limita el rango personalizado a ${MAX_CUSTOM_RANGE_DAYS} días, ambos extremos incluidos`, () => {
    // 1 jul -> 30 sep = 92 días
    expect(resolveHistoryWindow({ range: 'custom', from: '2026-07-01', to: '2026-09-30' }, NOW).ok).toBe(true)
    const tooLong = resolveHistoryWindow({ range: 'custom', from: '2026-07-01', to: '2026-10-01' }, NOW)
    expect(tooLong).toEqual({ ok: false, message: `El rango máximo es de ${MAX_CUSTOM_RANGE_DAYS} días.` })
  })
})

describe('defaultCustomRange', () => {
  it('son las dos últimas semanas en hora local', () => {
    expect(defaultCustomRange(new Date(2026, 10, 15, 10, 0))).toEqual({ from: '2026-11-01', to: '2026-11-15' })
  })
})

describe('toChartPoints', () => {
  it('añade el % bloqueado de cada punto, sin dividir entre cero', () => {
    const points = toChartPoints([
      { timestamp: '2026-11-01T10:00:00Z', totalQueries: 200, blockedQueries: 50 },
      { timestamp: '2026-11-01T10:30:00Z', totalQueries: 0, blockedQueries: 0 },
    ])
    expect(points.map((point) => point.blockedPercent)).toEqual([25, 0])
  })
})

describe('ejes del gráfico', () => {
  it('niceMax redondea al alza a un máximo "bonito"', () => {
    expect(niceMax(1)).toBe(1)
    expect(niceMax(1720)).toBe(2000)
    expect(niceMax(2000)).toBe(2000)
    expect(niceMax(2001)).toBe(2500)
    expect(niceMax(0)).toBe(1)
  })

  it('formatCompact', () => {
    expect(formatCompact(800)).toBe('800')
    expect(formatCompact(1500)).toBe('1,5 k')
    expect(formatCompact(12_400)).toBe('12 k')
  })

  it('formatAxisTick según el rango', () => {
    const iso = new Date(2026, 10, 3, 14, 5).toISOString() // martes 3 nov, hora local
    expect(formatAxisTick(iso, '24h')).toBe('14:05')
    expect(formatAxisTick(iso, '7d')).toBe('mar 3')
    expect(formatAxisTick(iso, '30d')).toBe('3 nov')
    expect(formatAxisTick(iso, 'custom')).toBe('3 nov')
    expect(formatAxisTick('no-es-una-fecha', '24h')).toBe('')
  })

  it('formatTooltipTitle según el rango', () => {
    const iso = new Date(2026, 10, 3, 14, 5).toISOString()
    expect(formatTooltipTitle(iso, '24h')).toBe('Hoy · 14:05')
    expect(formatTooltipTitle(iso, '7d')).toBe('mar 3 nov · 14:05')
    expect(formatTooltipTitle(iso, 'custom')).toBe('mar 3 nov')
  })
})

describe('pickAxisTicks', () => {
  // Un punto cada 2 h durante `days` días, empezando a medianoche local
  const series = (days: number): { timestamp: string }[] =>
    Array.from({ length: days * 12 }, (_, index) => ({
      timestamp: new Date(2026, 9, 26, index * 2).toISOString(),
    }))

  it('en 24 h deja que recharts reparta las marcas', () => {
    expect(pickAxisTicks(series(1), '24h')).toBeUndefined()
  })

  it('en 7 d da una marca por día, sin etiquetas repetidas', () => {
    const ticks = pickAxisTicks(series(7), '7d')
    expect(ticks).toHaveLength(7)
    const labels = (ticks ?? []).map((tick) => formatAxisTick(tick, '7d'))
    expect(new Set(labels).size).toBe(7)
  })

  it('con muchos días aclara las marcas hasta el máximo', () => {
    const ticks = pickAxisTicks(series(60), '30d', 8)
    expect(ticks?.length).toBeLessThanOrEqual(8)
    expect(ticks?.length).toBeGreaterThan(2)
  })

  it('sin puntos no hay marcas', () => {
    expect(pickAxisTicks([], '7d')).toEqual([])
  })
})

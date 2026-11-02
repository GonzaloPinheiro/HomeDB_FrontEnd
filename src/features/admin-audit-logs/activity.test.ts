import { describe, expect, it } from 'vitest'

import {
  ACTIVITY_RANGE_IDS,
  ACTIVITY_RANGES,
  activityWindow,
  fillDailySeries,
  summarizeActivity,
} from './activity'

const NOW = Date.parse('2026-11-02T18:30:00Z')

describe('activityWindow', () => {
  it('7 días = hoy y los 6 anteriores, en días UTC', () => {
    expect(activityWindow(7, NOW)).toEqual({ from: '2026-10-27', to: '2026-11-02' })
  })

  it('1 día = solo hoy', () => {
    expect(activityWindow(1, NOW)).toEqual({ from: '2026-11-02', to: '2026-11-02' })
  })

  it('cruza el fin de mes y de año', () => {
    expect(activityWindow(3, Date.parse('2026-01-01T00:00:00Z'))).toEqual({ from: '2025-12-30', to: '2026-01-01' })
  })

  it('usa el día UTC, no el local: a las 23:59 UTC sigue siendo ese día', () => {
    expect(activityWindow(1, Date.parse('2026-11-02T23:59:59Z')).to).toBe('2026-11-02')
    expect(activityWindow(1, Date.parse('2026-11-03T00:00:00Z')).to).toBe('2026-11-03')
  })

  it('los rangos ofrecidos tienen días enteros y positivos', () => {
    for (const id of ACTIVITY_RANGE_IDS) {
      expect(Number.isInteger(ACTIVITY_RANGES[id].days)).toBe(true)
      expect(ACTIVITY_RANGES[id].days).toBeGreaterThan(0)
    }
  })
})

describe('fillDailySeries', () => {
  const window = { from: '2026-10-30', to: '2026-11-02' }

  it('un punto por día de la ventana, con 0 donde el backend no devolvió nada', () => {
    expect(fillDailySeries([{ date: '2026-10-31', count: 5 }], window)).toEqual([
      { date: '2026-10-30', count: 0 },
      { date: '2026-10-31', count: 5 },
      { date: '2026-11-01', count: 0 },
      { date: '2026-11-02', count: 0 },
    ])
  })

  it('ignora los días fuera de la ventana y suma los duplicados', () => {
    const series = fillDailySeries(
      [
        { date: '2026-10-01', count: 99 },
        { date: '2026-11-01', count: 2 },
        { date: '2026-11-01', count: 3 },
      ],
      window,
    )
    expect(series.map((point) => point.count)).toEqual([0, 0, 5, 0])
  })

  it('sin datos: toda la ventana a cero (la gráfica no se queda sin ejes)', () => {
    expect(fillDailySeries([], window)).toHaveLength(4)
  })

  it('una ventana de un día da un punto', () => {
    expect(fillDailySeries([], { from: '2026-11-02', to: '2026-11-02' })).toEqual([{ date: '2026-11-02', count: 0 }])
  })
})

describe('summarizeActivity', () => {
  it('suma y encuentra el pico (el primero si hay empate)', () => {
    const series = [
      { date: 'a', count: 2 },
      { date: 'b', count: 7 },
      { date: 'c', count: 7 },
      { date: 'd', count: 0 },
    ]
    expect(summarizeActivity(series)).toEqual({ total: 16, peak: { date: 'b', count: 7 } })
  })

  it('sin actividad: total 0 y sin pico', () => {
    expect(summarizeActivity([{ date: 'a', count: 0 }])).toEqual({ total: 0, peak: null })
    expect(summarizeActivity([])).toEqual({ total: 0, peak: null })
  })
})

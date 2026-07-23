import { describe, expect, it } from 'vitest'

import { rangeToQuery, systemMonitorKeys } from './api'

const NOW = new Date('2026-07-23T12:00:00.000Z')

describe('rangeToQuery', () => {
  it('1h -> ventana de una hora terminando en `now`', () => {
    expect(rangeToQuery('1h', NOW)).toEqual({
      from: '2026-07-23T11:00:00.000Z',
      to: '2026-07-23T12:00:00.000Z',
    })
  })

  it('24h -> ventana de un día', () => {
    expect(rangeToQuery('24h', NOW)).toEqual({
      from: '2026-07-22T12:00:00.000Z',
      to: '2026-07-23T12:00:00.000Z',
    })
  })

  it('7d -> ventana de siete días', () => {
    expect(rangeToQuery('7d', NOW)).toEqual({
      from: '2026-07-16T12:00:00.000Z',
      to: '2026-07-23T12:00:00.000Z',
    })
  })

  it('30d -> ventana de treinta días', () => {
    expect(rangeToQuery('30d', NOW)).toEqual({
      from: '2026-06-23T12:00:00.000Z',
      to: '2026-07-23T12:00:00.000Z',
    })
  })
})

describe('systemMonitorKeys.history — cache por rango', () => {
  it('cada rango tiene una query key distinta', () => {
    const keys = ['1h', '24h', '7d', '30d'] as const
    const serialized = new Set(keys.map((range) => JSON.stringify(systemMonitorKeys.history(range))))
    expect(serialized.size).toBe(keys.length)
  })
})

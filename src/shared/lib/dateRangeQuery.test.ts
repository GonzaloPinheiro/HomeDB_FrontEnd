import { describe, expect, it } from 'vitest'

import { toUtcDayEnd, toUtcDayStart } from './dateRangeQuery'

describe('dateRangeQuery', () => {
  it('toUtcDayStart ancla al inicio del día en UTC', () => {
    expect(toUtcDayStart('2026-07-01')).toBe('2026-07-01T00:00:00Z')
  })

  it('toUtcDayEnd ancla al final del día en UTC', () => {
    expect(toUtcDayEnd('2026-07-01')).toBe('2026-07-01T23:59:59Z')
  })
})

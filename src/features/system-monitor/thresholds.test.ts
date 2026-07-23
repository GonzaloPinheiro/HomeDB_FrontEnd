import { describe, expect, it } from 'vitest'

import { getThresholdStatus } from './thresholds'

describe('getThresholdStatus', () => {
  it('valor normal (por debajo del umbral) -> normal', () => {
    expect(getThresholdStatus('cpu', 50)).toBe('normal')
  })

  it('valor justo en el umbral -> normal (hay que SUPERARLO, no igualarlo)', () => {
    expect(getThresholdStatus('cpu', 85)).toBe('normal')
    expect(getThresholdStatus('temperature', 75)).toBe('normal')
  })

  it('valor por encima del umbral -> critical', () => {
    expect(getThresholdStatus('cpu', 85.1)).toBe('critical')
    expect(getThresholdStatus('temperature', 80)).toBe('critical')
  })

  it('valor null (sensor caído) -> normal, no hay dato con el que decidir', () => {
    expect(getThresholdStatus('memory', null)).toBe('normal')
  })

  it('cada métrica usa su propio umbral', () => {
    expect(getThresholdStatus('disk', 90)).toBe('critical')
    expect(getThresholdStatus('temperature', 90)).toBe('critical')
    expect(getThresholdStatus('memory', 76)).toBe('normal')
  })
})

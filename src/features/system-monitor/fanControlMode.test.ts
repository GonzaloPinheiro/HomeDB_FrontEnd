import { describe, expect, it } from 'vitest'

import { normalizeFanControlMode } from './fanControlMode'

describe('normalizeFanControlMode', () => {
  it('valores reales del lector Linux, ya en minúsculas', () => {
    expect(normalizeFanControlMode('off')).toBe('off')
    expect(normalizeFanControlMode('manual')).toBe('manual')
    expect(normalizeFanControlMode('automatic')).toBe('automatic')
    expect(normalizeFanControlMode('unknown')).toBe('unknown')
  })

  it('valores reales del lector falso de desarrollo (casing distinto)', () => {
    expect(normalizeFanControlMode('Manual')).toBe('manual')
    // "Auto" no es solo un casing distinto de "automatic" — es una palabra
    // distinta, aliasada deliberadamente (ver comentario en fanControlMode.ts)
    expect(normalizeFanControlMode('Auto')).toBe('automatic')
  })

  it('casing arbitrario se normaliza igual', () => {
    expect(normalizeFanControlMode('MANUAL')).toBe('manual')
    expect(normalizeFanControlMode('OFF')).toBe('off')
  })

  it('null o valor no reconocido -> unknown', () => {
    expect(normalizeFanControlMode(null)).toBe('unknown')
    expect(normalizeFanControlMode('')).toBe('unknown')
    expect(normalizeFanControlMode('algo-inesperado')).toBe('unknown')
  })
})

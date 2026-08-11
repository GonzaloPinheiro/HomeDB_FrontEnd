import { describe, expect, it } from 'vitest'

import { aggregateProgress, backoffDelayMs, computeChunkPlan } from './pipeline'

describe('computeChunkPlan', () => {
  it('reparte un archivo exacto en chunks del mismo tamaño', () => {
    const plan = computeChunkPlan(30, 10)
    expect(plan.totalChunks).toBe(3)
    expect(plan.chunkSizes).toEqual([10, 10, 10])
  })

  it('el último chunk se queda con el resto cuando no divide exacto', () => {
    const plan = computeChunkPlan(25, 10)
    expect(plan.totalChunks).toBe(3)
    expect(plan.chunkSizes).toEqual([10, 10, 5])
  })

  it('un archivo menor que un chunk produce un único chunk con su tamaño real', () => {
    const plan = computeChunkPlan(5, 10)
    expect(plan.totalChunks).toBe(1)
    expect(plan.chunkSizes).toEqual([5])
  })

  it('nunca produce 0 chunks, ni con tamaño 0 (defensivo)', () => {
    const plan = computeChunkPlan(0, 10)
    expect(plan.totalChunks).toBe(1)
  })
})

describe('backoffDelayMs', () => {
  it('crece exponencialmente a partir de 500ms', () => {
    expect(backoffDelayMs(1)).toBe(500)
    expect(backoffDelayMs(2)).toBe(1000)
    expect(backoffDelayMs(3)).toBe(2000)
  })
})

describe('aggregateProgress', () => {
  const chunkSizes = [10, 10, 5] // total 25

  it('0% sin ningún chunk confirmado ni progreso parcial', () => {
    expect(aggregateProgress(chunkSizes, 0, 0, 25)).toBe(0)
  })

  it('suma los chunks ya confirmados más el progreso parcial del chunk en curso', () => {
    // 1 chunk confirmado (10 bytes) + 4 bytes subidos del segundo chunk, sobre 25 totales
    expect(aggregateProgress(chunkSizes, 1, 4, 25)).toBe(Math.round((14 / 25) * 100))
  })

  it('100% con todos los chunks confirmados', () => {
    expect(aggregateProgress(chunkSizes, 3, 0, 25)).toBe(100)
  })

  it('nunca supera 100 aunque el progreso parcial se pase (defensivo)', () => {
    expect(aggregateProgress(chunkSizes, 3, 999, 25)).toBe(100)
  })

  it('0% si el tamaño total es inválido, sin dividir por cero', () => {
    expect(aggregateProgress(chunkSizes, 0, 0, 0)).toBe(0)
  })
})

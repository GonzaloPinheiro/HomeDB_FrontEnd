import { describe, expect, it } from 'vitest'

import {
  BACKEND_CHUNK_REQUEST_LIMIT_BYTES,
  CHUNK_SIZE_BYTES,
  MAX_PARALLEL_CHUNK_UPLOADS,
  aggregateProgress,
  backoffDelayMs,
  computeChunkPlan,
} from './pipeline'

describe('constantes de la subida por chunks', () => {
  it('un chunk cabe en el límite de la petición del backend con margen para el sobre multipart', () => {
    // Si alguien sube CHUNK_SIZE_BYTES por encima, el backend responde 413 y
    // ninguna subida de más de un chunk funciona: este test lo evita (§7.4).
    const multipartOverheadMarginBytes = 1024 * 1024
    expect(CHUNK_SIZE_BYTES + multipartOverheadMarginBytes).toBeLessThanOrEqual(BACKEND_CHUNK_REQUEST_LIMIT_BYTES)
  })

  it('el paralelismo es un entero positivo', () => {
    expect(Number.isInteger(MAX_PARALLEL_CHUNK_UPLOADS)).toBe(true)
    expect(MAX_PARALLEL_CHUNK_UPLOADS).toBeGreaterThanOrEqual(1)
  })
})

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
    expect(aggregateProgress(chunkSizes, [0, 0, 0], 25)).toBe(0)
  })

  it('suma los chunks confirmados más el progreso parcial del chunk en curso', () => {
    // 1 chunk confirmado (10 bytes) + 4 bytes subidos del segundo chunk, sobre 25 totales
    expect(aggregateProgress(chunkSizes, [10, 4, 0], 25)).toBe(Math.round((14 / 25) * 100))
  })

  it('suma el progreso parcial de varios chunks en vuelo a la vez', () => {
    expect(aggregateProgress(chunkSizes, [3, 4, 2], 25)).toBe(Math.round((9 / 25) * 100))
  })

  it('cuenta chunks confirmados que no son un prefijo (paralelo o reanudación)', () => {
    // El 1º y el 3º confirmados, el 2º sin empezar
    expect(aggregateProgress(chunkSizes, [10, 0, 5], 25)).toBe(60)
  })

  it('100% con todos los chunks confirmados', () => {
    expect(aggregateProgress(chunkSizes, [10, 10, 5], 25)).toBe(100)
  })

  it('acota cada chunk a su tamaño: el sobre multipart no hace pasarse (defensivo)', () => {
    expect(aggregateProgress(chunkSizes, [999, 0, 0], 25)).toBe(40)
    expect(aggregateProgress(chunkSizes, [999, 999, 999], 25)).toBe(100)
  })

  it('trata como 0 un chunk sin entrada o con valor negativo', () => {
    expect(aggregateProgress(chunkSizes, [10], 25)).toBe(40)
    expect(aggregateProgress(chunkSizes, [-5, 0, 0], 25)).toBe(0)
  })

  it('0% si el tamaño total es inválido, sin dividir por cero', () => {
    expect(aggregateProgress(chunkSizes, [0, 0, 0], 0)).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'

import { downsampleSeries } from './downsample'

type Point = { t: number; v: number | null }
const value = (p: Point) => p.v

describe('downsampleSeries (CLAUDE.md §6.13)', () => {
  it('no toca una serie que ya cabe', () => {
    const data: Point[] = [{ t: 0, v: 1 }, { t: 1, v: 2 }]
    expect(downsampleSeries(data, value, 5)).toEqual(data)
  })

  it('reduce al máximo de puntos conservando el orden cronológico', () => {
    const data: Point[] = Array.from({ length: 1000 }, (_, t) => ({ t, v: t % 50 }))
    const result = downsampleSeries(data, value, 100)
    expect(result).toHaveLength(100)
    expect(result.map((p) => p.t)).toEqual([...result.map((p) => p.t)].sort((a, b) => a - b))
  })

  it('conserva los picos de cada tramo', () => {
    const data: Point[] = Array.from({ length: 100 }, (_, t) => ({ t, v: t === 37 ? 99 : 1 }))
    const result = downsampleSeries(data, value, 10)
    expect(result.some((p) => p.v === 99)).toBe(true)
  })

  it('un tramo entero sin valor conserva un punto null (hueco, no 0)', () => {
    const data: Point[] = [
      ...Array.from({ length: 10 }, (_, t) => ({ t, v: 5 })),
      ...Array.from({ length: 10 }, (_, t) => ({ t: 10 + t, v: null })),
    ]
    const result = downsampleSeries(data, value, 2)
    expect(result.map((p) => p.v)).toEqual([5, null])
  })

  it('no muta la entrada', () => {
    const data: Point[] = Array.from({ length: 50 }, (_, t) => ({ t, v: t }))
    const copy = data.map((p) => ({ ...p }))
    downsampleSeries(data, value, 5)
    expect(data).toEqual(copy)
  })
})

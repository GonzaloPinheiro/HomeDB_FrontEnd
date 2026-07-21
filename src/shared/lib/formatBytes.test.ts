import { describe, expect, it } from 'vitest'

import { formatBytes } from './formatBytes'

describe('formatBytes', () => {
  it('bytes por debajo de 1 KB', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1023)).toBe('1023 B')
  })

  it('un decimal para valores < 10, ninguno a partir de ahí', () => {
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(240 * 1024)).toBe('240 KB')
    expect(formatBytes(2.4 * 1024 ** 3)).toBe('2.4 GB')
    expect(formatBytes(10.6 * 1024 ** 3)).toBe('11 GB')
  })

  it('unidades grandes', () => {
    expect(formatBytes(3 * 1024 ** 4)).toBe('3 TB')
  })

  it('valores inválidos', () => {
    expect(formatBytes(-1)).toBe('—')
    expect(formatBytes(Number.NaN)).toBe('—')
  })
})

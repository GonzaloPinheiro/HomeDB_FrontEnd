import { describe, expect, it } from 'vitest'

import { storageLocationSchema, storageLocationsSchema } from './types'

// Forma tal cual la serializa el backend (camelCase, enums como NÚMERO) — CLAUDE.md §5.4
const WIRE_LOCATION = {
  locationKey: 'main',
  diskKey: 'm2-1',
  usage: 1,
  isDefault: true,
  isAvailable: true,
  isWritable: true,
  reason: null,
  checkedAtUtc: '2026-11-21T10:00:00Z',
  totalBytes: 500_000_000_000,
  usedBytes: 120_000_000_000,
  freeBytes: 380_000_000_000,
  minFreeBytes: 5_368_709_120,
  maxUsedBytes: null,
}

describe('storageLocationSchema', () => {
  it('normaliza `usage` numérico a literales (Personal=1, Media=2, Temp=3, Backups=4)', () => {
    const usages = [1, 2, 3, 4].map((usage) => storageLocationSchema.parse({ ...WIRE_LOCATION, usage }).usage)
    expect(usages).toEqual(['personal', 'media', 'temp', 'backups'])
  })

  it('tolera `usage` como nombre, por si el backend añade el JsonStringEnumConverter', () => {
    expect(storageLocationSchema.parse({ ...WIRE_LOCATION, usage: 'Backups' }).usage).toBe('backups')
  })

  it('un `usage` desconocido falla (red de seguridad ante un valor nuevo del backend)', () => {
    expect(() => storageLocationSchema.parse({ ...WIRE_LOCATION, usage: 9 })).toThrow()
  })

  it('un disco caído llega con las cifras a null y su motivo', () => {
    const down = storageLocationSchema.parse({
      ...WIRE_LOCATION,
      diskKey: 'hdd1',
      isAvailable: false,
      isWritable: false,
      reason: 'marker file is missing',
      totalBytes: null,
      usedBytes: null,
      freeBytes: null,
    })
    expect(down).toMatchObject({ totalBytes: null, usedBytes: null, freeBytes: null, reason: 'marker file is missing' })
  })

  it('acepta isAvailable=true con la capacidad a null (el disco cayó entre comprobaciones)', () => {
    const parsed = storageLocationSchema.parse({ ...WIRE_LOCATION, totalBytes: null, usedBytes: null, freeBytes: null })
    expect(parsed.isAvailable).toBe(true)
    expect(parsed.totalBytes).toBeNull()
  })

  it('exige los campos del contrato: sin `diskKey` falla', () => {
    const incomplete: Record<string, unknown> = { ...WIRE_LOCATION }
    delete incomplete.diskKey
    expect(() => storageLocationSchema.parse(incomplete)).toThrow()
  })

  it('valida una lista (también vacía)', () => {
    expect(storageLocationsSchema.parse([])).toEqual([])
    expect(storageLocationsSchema.parse([WIRE_LOCATION])).toHaveLength(1)
  })
})

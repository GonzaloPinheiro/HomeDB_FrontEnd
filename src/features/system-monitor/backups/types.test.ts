import { describe, expect, it } from 'vitest'

import { backupEntrySchema, backupHistorySchema } from './types'

// Forma real del wire: enums como número (el backend no registra JsonStringEnumConverter).
const WIRE_ENTRY = {
  id: 7,
  level: 1,
  startedAt: '2026-09-20T03:00:00Z',
  completedAt: '2026-09-20T03:05:00Z',
  status: 2,
  filesBackedUpSizeBytes: 5_000_000,
  databaseDumpSizeBytes: 120_000,
  errorMessage: null,
  backupPath: '/storage/backups/daily/backup_actual',
  deletedAt: null,
}

describe('backupEntrySchema', () => {
  it('normaliza los enums numéricos del backend (Level, Status)', () => {
    const parsed = backupEntrySchema.parse(WIRE_ENTRY)
    expect(parsed.level).toBe('daily')
    expect(parsed.status).toBe('success')
  })

  it.each([
    [1, 'running'],
    [2, 'success'],
    [3, 'failed'],
  ] as const)('Status %i -> %s', (wire, expected) => {
    expect(backupEntrySchema.parse({ ...WIRE_ENTRY, status: wire }).status).toBe(expected)
  })

  it('tolera los enums como nombre (si el backend añade JsonStringEnumConverter)', () => {
    const parsed = backupEntrySchema.parse({ ...WIRE_ENTRY, level: 'Daily', status: 'Failed' })
    expect(parsed.level).toBe('daily')
    expect(parsed.status).toBe('failed')
  })

  it('rechaza un estado desconocido en vez de dejarlo pasar', () => {
    expect(() => backupEntrySchema.parse({ ...WIRE_ENTRY, status: 99 })).toThrow()
  })

  it('las fechas y el mensaje de error opcionales aceptan null (backup en curso o rotado)', () => {
    const parsed = backupEntrySchema.parse({
      ...WIRE_ENTRY,
      status: 1,
      completedAt: null,
      backupPath: null,
      deletedAt: null,
    })
    expect(parsed.completedAt).toBeNull()
  })
})

describe('backupHistorySchema', () => {
  it('respuesta paginada con `items` (mismo envoltorio que Logs y Auditoría)', () => {
    const parsed = backupHistorySchema.parse({
      items: [WIRE_ENTRY],
      totalCount: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    })
    expect(parsed.items).toHaveLength(1)
  })
})

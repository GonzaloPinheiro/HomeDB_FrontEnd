import { describe, expect, it } from 'vitest'

import { summarizeBackups, totalBackupBytes } from './summary'
import type { BackupEntry } from './types'

function entry(overrides: Partial<BackupEntry>): BackupEntry {
  return {
    id: 1,
    level: 'daily',
    startedAt: '2026-09-20T03:00:00Z',
    completedAt: '2026-09-20T03:05:00Z',
    status: 'success',
    filesBackedUpSizeBytes: 1000,
    databaseDumpSizeBytes: 200,
    errorMessage: null,
    backupPath: '/storage/backups/daily/backup_actual',
    deletedAt: null,
    ...overrides,
  }
}

describe('summarizeBackups', () => {
  it('historial vacío -> sin registros y sin backup en curso', () => {
    expect(summarizeBackups([])).toEqual({ latest: null, lastSuccess: null, isRunning: false })
  })

  it('el más reciente se decide por fecha, no por posición en el array', () => {
    const older = entry({ id: 1, startedAt: '2026-09-19T03:00:00Z' })
    const newer = entry({ id: 2, startedAt: '2026-09-20T03:00:00Z' })
    expect(summarizeBackups([older, newer]).latest?.id).toBe(2)
  })

  it('último correcto: salta un fallo más reciente hasta el último éxito real', () => {
    const success = entry({ id: 1, startedAt: '2026-09-19T03:00:00Z' })
    const failed = entry({ id: 2, startedAt: '2026-09-20T03:00:00Z', status: 'failed', errorMessage: 'rsync falló' })
    const summary = summarizeBackups([failed, success])
    expect(summary.latest?.id).toBe(2)
    expect(summary.lastSuccess?.id).toBe(1)
  })

  it('solo fallos -> hay último registro pero ningún último correcto', () => {
    const summary = summarizeBackups([entry({ status: 'failed' })])
    expect(summary.latest).not.toBeNull()
    expect(summary.lastSuccess).toBeNull()
  })

  it('cualquier entrada en curso marca isRunning', () => {
    expect(summarizeBackups([entry({ status: 'running', completedAt: null })]).isRunning).toBe(true)
    expect(summarizeBackups([entry({ status: 'success' })]).isRunning).toBe(false)
  })

  it('no muta el array recibido', () => {
    const items = [entry({ id: 1, startedAt: '2026-09-19T03:00:00Z' }), entry({ id: 2 })]
    summarizeBackups(items)
    expect(items.map((item) => item.id)).toEqual([1, 2])
  })
})

describe('totalBackupBytes', () => {
  it('suma archivos + volcado de la base de datos', () => {
    expect(totalBackupBytes(entry({ filesBackedUpSizeBytes: 1000, databaseDumpSizeBytes: 200 }))).toBe(1200)
  })
})

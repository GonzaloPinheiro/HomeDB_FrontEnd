import type { BackupEntry } from './types'

export type BackupSummary = {
  /** Registro más reciente (por `startedAt`), sea cual sea su estado. */
  latest: BackupEntry | null
  /** Último backup terminado con éxito — el que realmente sirve para restaurar. */
  lastSuccess: BackupEntry | null
  isRunning: boolean
}

/**
 * Resume el historial para la cabecera del panel. Lógica pura extraída para
 * poder testearla (CLAUDE.md §9). No asume el orden en que llegan los items
 * (el backend ordena por `startedAt` descendente hoy, pero no es un contrato
 * que merezca la pena fiar): busca por fecha.
 */
export function summarizeBackups(items: readonly BackupEntry[]): BackupSummary {
  const sorted = [...items].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
  const latest = sorted[0] ?? null
  const lastSuccess = sorted.find((entry) => entry.status === 'success') ?? null
  return { latest, lastSuccess, isRunning: sorted.some((entry) => entry.status === 'running') }
}

/** Tamaño total de un backup: archivos + volcado de la base de datos. */
export function totalBackupBytes(entry: BackupEntry): number {
  return entry.filesBackedUpSizeBytes + entry.databaseDumpSizeBytes
}

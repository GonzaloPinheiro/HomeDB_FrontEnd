import type { ApiError } from '@/shared/api/client'
import { ApiErrorCodes } from '@/shared/api/errors'

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

/**
 * Mensaje del toast cuando `POST /backup/Daily/trigger` responde con un error de la API.
 *
 * CLAUDE.md §5.4: un 503/1028 aquí significa que el disco de backups o uno de los
 * discos de origen está caído, y el backend NO crea registro en el historial (se
 * comprueba antes de tocar nada), así que el texto genérico del mapa de errores
 * ("un disco no está disponible") se concreta para este caso. El resto de códigos
 * usan su mensaje mapeado.
 */
export function triggerBackupErrorMessage(error: ApiError): string {
  if (error.errorCode === ApiErrorCodes.StorageLocationUnavailable) {
    return 'No se pudo iniciar el backup: el disco de backups o uno de los discos de origen no está disponible'
  }
  return error.message
}

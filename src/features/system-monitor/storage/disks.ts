import { METRIC_THRESHOLDS } from '../thresholds'
import type { LocationUsage, StorageLocation } from './types'

// CLAUDE.md §6.13/§5.4: lógica pura de la tarjeta de almacenamiento, sin React, para poder
// testearla (§9). El backend manda una fila por UBICACIÓN; la pantalla trabaja por DISCO.

/** Un disco físico con sus ubicaciones. Disponibilidad y cifras son las del disco. */
export type StorageDisk = {
  key: string
  isAvailable: boolean
  isWritable: boolean
  reason: string | null
  checkedAtUtc: string
  totalBytes: number | null
  usedBytes: number | null
  freeBytes: number | null
  /** Límite del disco (0 = desactivado). */
  minFreeBytes: number
  locations: StorageDiskLocation[]
}

export type StorageDiskLocation = {
  key: string
  usage: LocationUsage
  isDefault: boolean
  /** Tope de uso de la UBICACIÓN, `null` = sin tope. */
  maxUsedBytes: number | null
}

/**
 * Agrupa las filas por `diskKey`, conservando el orden de la configuración (el de la primera
 * aparición de cada disco). Los datos del disco se toman de su PRIMERA fila: el backend los repite
 * idénticos en todas las de un disco, así que **nunca se suman** (sumar `totalBytes` de `main` y
 * `temp` contaría dos veces el mismo M.2).
 */
export function groupByDisk(locations: readonly StorageLocation[]): StorageDisk[] {
  const disks = new Map<string, StorageDisk>()
  for (const row of locations) {
    let disk = disks.get(row.diskKey)
    if (disk === undefined) {
      disk = {
        key: row.diskKey,
        isAvailable: row.isAvailable,
        isWritable: row.isWritable,
        reason: row.reason,
        checkedAtUtc: row.checkedAtUtc,
        totalBytes: row.totalBytes,
        usedBytes: row.usedBytes,
        freeBytes: row.freeBytes,
        minFreeBytes: row.minFreeBytes,
        locations: [],
      }
      disks.set(row.diskKey, disk)
    }
    disk.locations.push({
      key: row.locationKey,
      usage: row.usage,
      isDefault: row.isDefault,
      maxUsedBytes: row.maxUsedBytes,
    })
  }
  return [...disks.values()]
}

/**
 * Estado de un disco, de más a menos grave (el primero que se cumple gana):
 * - `unavailable`: no está disponible (desmontado, marcador que falta...).
 * - `readOnly`: está pero no se puede escribir (los docks USB suelen remontarse en solo lectura).
 * - `belowMinFree`: le queda menos que su espacio libre mínimo (`minFreeBytes`): el backend ya
 *   rechaza cualquier subida con 507/1029.
 * - `highUsage`: supera el umbral de uso del Monitor (`METRIC_THRESHOLDS.disk`, criterio de este
 *   front, §6.13).
 * - `noCapacity`: está disponible pero no llegó su capacidad (cayó entre comprobaciones).
 * - `ok`.
 */
export type DiskStatus = 'ok' | 'highUsage' | 'belowMinFree' | 'readOnly' | 'unavailable' | 'noCapacity'

export type DiskTone = 'positive' | 'warning' | 'critical' | 'neutral'

export const DISK_STATUS_META: Record<DiskStatus, { label: string; tone: DiskTone }> = {
  ok: { label: 'Correcto', tone: 'positive' },
  highUsage: { label: 'Uso alto', tone: 'warning' },
  belowMinFree: { label: 'Sin espacio libre', tone: 'critical' },
  readOnly: { label: 'Solo lectura', tone: 'warning' },
  unavailable: { label: 'No disponible', tone: 'critical' },
  noCapacity: { label: 'Sin datos de capacidad', tone: 'neutral' },
}

/** % usado (0-100), o `null` si falta alguna de las dos cifras o el total no es positivo. */
export function getUsagePercent(disk: Pick<StorageDisk, 'totalBytes' | 'usedBytes'>): number | null {
  if (disk.totalBytes === null || disk.usedBytes === null || disk.totalBytes <= 0) return null
  return Math.min(100, Math.max(0, (disk.usedBytes / disk.totalBytes) * 100))
}

export function getDiskStatus(disk: StorageDisk): DiskStatus {
  if (!disk.isAvailable) return 'unavailable'
  if (!disk.isWritable) return 'readOnly'
  if (disk.minFreeBytes > 0 && disk.freeBytes !== null && disk.freeBytes < disk.minFreeBytes) return 'belowMinFree'
  const percent = getUsagePercent(disk)
  if (percent === null) return 'noCapacity'
  return percent > METRIC_THRESHOLDS.disk ? 'highUsage' : 'ok'
}

export function getDiskTone(disk: StorageDisk): DiskTone {
  return DISK_STATUS_META[getDiskStatus(disk)].tone
}

/**
 * Posición (0-100) de la marca de "espacio libre mínimo" sobre la barra de uso: a partir de ahí
 * la barra entra en la reserva que el backend no deja ocupar. `null` si no hay mínimo o no se
 * conoce el total.
 */
export function getMinFreeMarkerPercent(disk: Pick<StorageDisk, 'totalBytes' | 'minFreeBytes'>): number | null {
  if (disk.minFreeBytes <= 0 || disk.totalBytes === null || disk.totalBytes <= 0) return null
  if (disk.minFreeBytes >= disk.totalBytes) return 0
  return (1 - disk.minFreeBytes / disk.totalBytes) * 100
}

export const USAGE_LABELS: Record<LocationUsage, string> = {
  personal: 'Personal',
  media: 'Media',
  temp: 'Temporal',
  backups: 'Backups',
}

// `reason` llega en inglés y genérico (sin rutas, para poder viajar en la API): se traduce por
// VALOR, nunca se muestra el texto crudo. "capacity could not be read" solo sale en los 503 de
// una subida, pero se cubre por si el backend lo añade a este endpoint.
const REASON_MESSAGES: Record<string, string> = {
  'disk path is not accessible': 'No se puede acceder al punto de montaje del disco: puede no estar conectado.',
  'marker file is missing': 'Falta el fichero marcador del disco (.homedb-location): puede no estar montado.',
  'marker file does not match the disk':
    'El fichero marcador no corresponde a este disco: puede haberse montado otro en su lugar.',
  'marker file could not be read': 'No se pudo leer el fichero marcador del disco.',
  'disk is not writable': 'El disco no admite escritura: puede haberse remontado en solo lectura.',
  'capacity could not be read': 'No se pudo leer la capacidad del disco.',
}

const UNKNOWN_REASON = 'El servidor no indicó un motivo reconocido.'

/** Motivo del fallo en español; `null` si el disco no informa ninguno. */
export function translateReason(reason: string | null): string | null {
  if (reason === null || reason.trim() === '') return null
  // `Object.hasOwn`: una clave heredada ("constructor") no debe contar como traducción
  return Object.hasOwn(REASON_MESSAGES, reason) ? REASON_MESSAGES[reason] : UNKNOWN_REASON
}

export type DiskProblems = {
  /** Discos con un estado distinto de `ok` y `noCapacity`. */
  count: number
  /** `critical` si alguno lo es, si no `warning`; `null` sin problemas. */
  tone: 'warning' | 'critical' | null
}

/** Resumen de problemas para avisar desde la tarjeta Disco sin abrir su vista. */
export function summarizeDiskProblems(disks: readonly StorageDisk[]): DiskProblems {
  let count = 0
  let critical = false
  for (const disk of disks) {
    const status = getDiskStatus(disk)
    if (status === 'ok' || status === 'noCapacity') continue
    count += 1
    if (DISK_STATUS_META[status].tone === 'critical') critical = true
  }
  return { count, tone: count === 0 ? null : critical ? 'critical' : 'warning' }
}

export type DiskMessage = { tone: 'warning' | 'critical'; text: string }

/**
 * Aviso que acompaña a un disco con problemas (el motivo ya traducido y, si hace falta, qué
 * implica). `null` si no hay nada que decir: un disco correcto, con uso alto o sin datos de
 * capacidad no lleva aviso (la insignia de estado ya lo dice).
 */
export function getDiskMessage(disk: StorageDisk): DiskMessage | null {
  const status = getDiskStatus(disk)
  if (status === 'unavailable') {
    return { tone: 'critical', text: translateReason(disk.reason) ?? 'El servidor no puede acceder a este disco.' }
  }
  if (status === 'readOnly') {
    return { tone: 'warning', text: translateReason(disk.reason) ?? 'El disco no admite escritura.' }
  }
  if (status === 'belowMinFree') {
    return {
      tone: 'critical',
      text: 'Queda menos del espacio libre mínimo configurado: el servidor rechaza nuevas subidas a este disco.',
    }
  }
  return null
}

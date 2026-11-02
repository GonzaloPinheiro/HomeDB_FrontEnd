import { formatBytes } from '@/shared/lib/formatBytes'

import type { VpnDevice, VpnOwner } from './types'

// CLAUDE.md §6.22: lógica de presentación sin React, para poder testearla (§9).

export type DeviceStatus = 'revoking' | 'active' | 'inactive' | 'never'

/**
 * Una revocación pendiente manda sobre todo lo demás: mientras el dispositivo siga en la lista
 * se enseña «Revocando…», aunque su handshake sea reciente.
 */
export function getDeviceStatus(
  device: Pick<VpnDevice, 'isActive' | 'lastHandshakeAt' | 'revocationRequestedAt'>,
): DeviceStatus {
  if (device.revocationRequestedAt !== null) return 'revoking'
  if (device.isActive) return 'active'
  return device.lastHandshakeAt === null ? 'never' : 'inactive'
}

export const STATUS_LABELS: Record<DeviceStatus, string> = {
  revoking: 'Revocando…',
  active: 'Activo',
  inactive: 'Inactivo',
  never: 'Nunca conectado',
}

/** Milisegundos -> "hace 8 s" / "hace 5 min" / "hace 3 h" / "hace 1 día" / "hace 19 días". */
export function formatAgo(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `hace ${seconds} s`
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`
  if (seconds < 86_400) return `hace ${Math.floor(seconds / 3600)} h`
  const days = Math.floor(seconds / 86_400)
  return days === 1 ? 'hace 1 día' : `hace ${days} días`
}

function toMs(iso: string): number | null {
  const ms = new Date(iso).getTime()
  return Number.isNaN(ms) ? null : ms
}

/** Handshake relativo a "ahora": "hace 8 s", o "Nunca" si el dispositivo no se ha conectado. */
export function formatHandshake(lastHandshakeAt: string | null, nowMs: number): string {
  if (lastHandshakeAt === null) return 'Nunca'
  const ms = toMs(lastHandshakeAt)
  return ms === null ? '—' : formatAgo(nowMs - ms)
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const pad = (value: number): string => String(value).padStart(2, '0')

/** Handshake absoluto en hora local: "3 nov · 14:05:09". */
export function formatHandshakeAbsolute(lastHandshakeAt: string | null): string {
  if (lastHandshakeAt === null) return 'Sin handshake registrado'
  const ms = toMs(lastHandshakeAt)
  if (ms === null) return '—'
  const date = new Date(ms)
  return `${date.getDate()} ${MONTHS[date.getMonth()]} · ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Clave pública abreviada para pantalla ("p7Qm2KxV9b…WfA="); la completa va en el tooltip y al copiar. */
export function formatShortKey(publicKey: string): string {
  return publicKey.length <= 18 ? publicKey : `${publicKey.slice(0, 10)}…${publicKey.slice(-6)}`
}

/** Iniciales de dos letras para el avatar del dueño; "–" si el dispositivo no tiene dueño. */
export function getOwnerInitials(ownerName: string | null): string {
  return ownerName === null || ownerName.trim() === '' ? '–' : ownerName.trim().slice(0, 2).toUpperCase()
}

/**
 * Una lectura de más de 5 minutos se considera desactualizada: el host genera la lectura con un
 * temporizador y la pantalla la pide cada 60 s, así que cinco minutos sin una nueva suele
 * significar que el temporizador está parado. Criterio de este front, no del backend.
 */
export const SNAPSHOT_STALE_MS = 5 * 60_000

export function getSnapshotAgeMs(snapshotAt: string, nowMs: number): number {
  const ms = toMs(snapshotAt)
  return ms === null ? 0 : Math.max(0, nowMs - ms)
}

export function isSnapshotStale(snapshotAt: string, nowMs: number): boolean {
  return getSnapshotAgeMs(snapshotAt, nowMs) > SNAPSHOT_STALE_MS
}

/**
 * Una revocación que lleva más de 3 minutos sin completarse se avisa: debería terminar en el
 * siguiente ciclo del temporizador del host. Criterio de este front, no del backend.
 */
export const REVOCATION_OVERDUE_MS = 3 * 60_000

export function getRevocationAgeMs(device: Pick<VpnDevice, 'revocationRequestedAt'>, nowMs: number): number | null {
  if (device.revocationRequestedAt === null) return null
  const ms = toMs(device.revocationRequestedAt)
  return ms === null ? null : Math.max(0, nowMs - ms)
}

export function isRevocationOverdue(device: Pick<VpnDevice, 'revocationRequestedAt'>, nowMs: number): boolean {
  const age = getRevocationAgeMs(device, nowMs)
  return age !== null && age > REVOCATION_OVERDUE_MS
}

export type DevicesSummary = {
  total: number
  active: number
  receivedBytes: number
  sentBytes: number
}

export function summarizeDevices(devices: readonly VpnDevice[]): DevicesSummary {
  return {
    total: devices.length,
    active: devices.filter((device) => device.isActive).length,
    receivedBytes: devices.reduce((sum, device) => sum + device.bytesReceived, 0),
    sentBytes: devices.reduce((sum, device) => sum + device.bytesSent, 0),
  }
}

/** "8 dispositivos · 3 activos · 12 GB de tráfico" */
export function describeSummary(summary: DevicesSummary): string {
  const devices = summary.total === 1 ? '1 dispositivo' : `${summary.total} dispositivos`
  const active = summary.active === 1 ? '1 activo' : `${summary.active} activos`
  return `${devices} · ${active} · ${formatBytes(summary.receivedBytes + summary.sentBytes)} de tráfico`
}

/**
 * Nombres de los dispositivos cuya revocación se ha completado entre dos lecturas: estaban en
 * «Revocando…» y ya no aparecen. Es la única señal de que el temporizador del host terminó el
 * trabajo (la revocación es asíncrona), y de ahí sale el aviso «revocado».
 */
export function findCompletedRevocations(previous: readonly VpnDevice[], next: readonly VpnDevice[]): string[] {
  const remaining = new Set(next.map((device) => device.publicKey))
  return previous
    .filter((device) => device.revocationRequestedAt !== null && !remaining.has(device.publicKey))
    .map((device) => device.name)
}

/** Revocar es irreversible (§11): hay que escribir el nombre exacto del dispositivo. */
export function isRevokeConfirmed(typed: string, deviceName: string): boolean {
  return typed.trim() === deviceName
}

/**
 * Dueños que ofrece el selector del detalle. Si el dueño actual del dispositivo no está en la lista
 * (todavía cargando, o un usuario ya borrado) se añade igualmente, para que el selector no se vea
 * vacío ni parezca que el dispositivo no tiene dueño.
 */
export function withCurrentOwner(owners: readonly VpnOwner[], device: Pick<VpnDevice, 'ownerId' | 'ownerName'>): VpnOwner[] {
  if (device.ownerId === null || owners.some((owner) => owner.id === device.ownerId)) return owners.slice()
  return [...owners, { id: device.ownerId, name: device.ownerName ?? `Usuario ${device.ownerId}` }]
}

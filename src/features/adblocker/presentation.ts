import type { AdBlockerStatus, FilterListStatus } from './types'

// CLAUDE.md §6.21: lógica de presentación sin React, para poder testearla (§9).

export type ProtectionMode = 'protected' | 'paused' | 'disabled'

/**
 * Protegido, pausado (con cuenta atrás) o desactivado hasta que el usuario lo reactive.
 * Una pausa cuyo `pausedUntil` ya pasó cuenta como desactivada: el servidor la
 * reactivará en su siguiente consulta, y mientras tanto no hay que decir "pausado"
 * con una cuenta atrás a cero.
 */
export function getProtectionMode(
  status: Pick<AdBlockerStatus, 'protectionEnabled' | 'pausedUntil'>,
  nowMs: number,
): ProtectionMode {
  if (status.protectionEnabled) return 'protected'
  if (status.pausedUntil !== null && new Date(status.pausedUntil).getTime() > nowMs) return 'paused'
  return 'disabled'
}

/** Milisegundos que faltan hasta `iso` (nunca negativo). `iso` inválido -> 0. */
export function msUntil(iso: string, nowMs: number): number {
  const target = new Date(iso).getTime()
  return Number.isNaN(target) ? 0 : Math.max(0, target - nowMs)
}

const pad = (value: number): string => String(value).padStart(2, '0')

/**
 * Cuenta atrás tipo reloj: "4:07" o "1:02:03". No usa `formatDuration` ("2 min 14 s")
 * porque aquí se actualiza cada segundo y el ancho debe ser estable.
 */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

/** ISO -> hora local "14:32" (para "Pausado hasta 14:32"). */
export function formatClock(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** % bloqueado sobre el total; 0 si aún no hay consultas (evita NaN/Infinity). */
export function computeBlockedPercent(totalQueries: number, blockedQueries: number): number {
  return totalQueries > 0 ? (blockedQueries / totalQueries) * 100 : 0
}

/** "12,3 %" — un decimal y coma, como en el resto de la app. */
export function formatPercent(value: number): string {
  return `${value.toFixed(1).replace('.', ',')} %`
}

/** Consultas por hora de media sobre la ventana de 24 h. */
export function queriesPerHour(totalQueries: number): number {
  return totalQueries / 24
}

/** "1 de cada N": N entero >= 1, o `null` si no se ha bloqueado nada. */
export function oneInEvery(percent: number): number | null {
  return percent > 0 ? Math.max(1, Math.round(100 / percent)) : null
}

/**
 * Una lista sin actualizar en más de 7 días se marca como desactualizada: AdGuard las
 * refresca solo (cada pocas horas por defecto), así que una semana sin tocarse suele
 * indicar que su descarga falla. Es un criterio de este front, no del backend.
 */
export const STALE_LIST_HOURS = 7 * 24

export function getListAgeHours(lastUpdatedIso: string, nowMs: number): number {
  const updated = new Date(lastUpdatedIso).getTime()
  return Number.isNaN(updated) ? 0 : Math.max(0, (nowMs - updated) / 3_600_000)
}

export function isListStale(list: Pick<FilterListStatus, 'lastUpdated'>, nowMs: number): boolean {
  return getListAgeHours(list.lastUpdated, nowMs) > STALE_LIST_HOURS
}

/** Horas de antigüedad -> "hace unos minutos" / "hace 5 h" / "ayer" / "hace 12 días". */
export function formatListAge(ageHours: number): string {
  if (ageHours < 1) return 'hace unos minutos'
  if (ageHours < 24) return `hace ${Math.floor(ageHours)} h`
  const days = Math.round(ageHours / 24)
  return days === 1 ? 'ayer' : `hace ${days} días`
}

export type ListsSummary = { active: number; total: number; stale: number }

export function summarizeLists(lists: readonly FilterListStatus[], nowMs: number): ListsSummary {
  return {
    active: lists.filter((list) => list.enabled).length,
    total: lists.length,
    stale: lists.filter((list) => isListStale(list, nowMs)).length,
  }
}

/** "5 de 8 activas · 2 sin actualizar" */
export function describeListsSummary(summary: ListsSummary): string {
  const base = `${summary.active} de ${summary.total} activas`
  return summary.stale > 0 ? `${base} · ${summary.stale} sin actualizar` : base
}

/** Host del panel de AdGuard ("192.168.1.2:3000") o `null` si la URL falta o no es válida. */
export function getPanelHost(panelUrl: string | null): string | null {
  if (panelUrl === null) return null
  try {
    return new URL(panelUrl).host
  } catch {
    return null
  }
}

export type NumberParseResult = { ok: true; value: number } | { ok: false; message: string }

/**
 * Pausa personalizada: entero de 1 a 1.440 minutos (24 h).
 * PENDIENTE (CLAUDE.md §6.21): el máximo es de este front; el backend recibe
 * `DurationSeconds` sin límite documentado. Ajustar a lo que acabe validando.
 */
export const MAX_PAUSE_MINUTES = 1440

export function parsePauseMinutes(raw: string): NumberParseResult {
  const value = Number(raw)
  if (raw.trim() === '' || !Number.isInteger(value) || value < 1 || value > MAX_PAUSE_MINUTES) {
    return { ok: false, message: `Escribe un número de minutos entre 1 y ${MAX_PAUSE_MINUTES}.` }
  }
  return { ok: true, value }
}

/** Umbral de alerta: entero de 0 a 100 (% bloqueado por debajo del cual se avisa). */
export function parseThresholdPercent(raw: string): NumberParseResult {
  if (!/^\d{1,3}$/.test(raw.trim()) || Number(raw) > 100) {
    return { ok: false, message: 'Introduce un número entero entre 0 y 100.' }
  }
  return { ok: true, value: Number(raw) }
}

/** Ancho de barra en % acotado a 0-100 (los datos reales pueden salirse por redondeos). */
export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value))
}

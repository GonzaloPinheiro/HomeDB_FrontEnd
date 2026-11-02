import type { StatTone } from '@/shared/components/StatCard'
import { formatUtcDay } from '@/shared/lib/formatDate'

import { actionLabel } from './actions'
import type { AuditLogsFilters, AuditSummary } from './api'

// Lógica pura de las tarjetas, los chips y el drill-down de Auditoría (CLAUDE.md §6.24), sin React, para
// poder testearla (§9).

type SensitiveItems = AuditSummary['sensitive']

/**
 * Total de acciones sensibles. Si el recuento de ALGUNA falló (`undefined`) no se puede dar una cifra
 * honesta —sería una suma parcial—, así que es `undefined` y la tarjeta muestra "No se pudo cargar".
 */
export function sensitiveTotal(items: SensitiveItems): number | undefined {
  let total = 0
  for (const item of items) {
    if (item.count === undefined) return undefined
    total += item.count
  }
  return total
}

/** Cero es bueno (verde); algo es "merece un vistazo" (ámbar), no una alarma: un cambio de contraseña es normal. */
export function sensitiveTone(total: number | undefined): StatTone {
  if (total === undefined) return 'neutral'
  return total === 0 ? 'ok' : 'warning'
}

/** "2 × alta de usuario · 1 × cambio de contraseña": solo las que tienen algo, de mayor a menor. */
export function sensitiveCaption(items: SensitiveItems): string {
  const present = items
    .filter((item): item is { action: string; count: number } => item.count !== undefined && item.count > 0)
    .sort((a, b) => b.count - a.count)
  if (present.length === 0) return 'Ninguna en este periodo'
  return present.map((item) => `${item.count} × ${actionLabel(item.action).toLowerCase()}`).join(' · ')
}

// --- Chips de filtros activos --------------------------------------------------------------

export type FilterChip = {
  key: string
  label: string
  /** Qué hay que limpiar para quitar este filtro. */
  clear: Partial<AuditLogsFilters>
}

/** "Usuario: ana (#5)", o "Usuario #5" mientras no se conoce el nombre. */
export function userChipLabel(userId: number, userName: string | null): string {
  return userName ? `Usuario: ${userName} (#${userId})` : `Usuario #${userId}`
}

/**
 * Un chip por cada filtro activo que NO se ve ya en la barra: el texto de usuario y la acción tienen su propio
 * control visible mostrando su valor; los demás (usuario exacto, recurso, fechas) viven dentro del panel
 * "Filtros" y sin chip quedarían ocultos tras el contador. `userName` es el nombre del usuario filtrado por
 * `userId`, si se conoce (sale de las filas cargadas).
 */
export function buildFilterChips(filters: AuditLogsFilters, userName: string | null): FilterChip[] {
  const chips: FilterChip[] = []
  if (filters.userId !== null) {
    chips.push({ key: 'userId', label: userChipLabel(filters.userId, userName), clear: { userId: null } })
  }
  if (filters.resourceType !== null) {
    chips.push({ key: 'resourceType', label: `Recurso: ${filters.resourceType}`, clear: { resourceType: null } })
  }
  if (filters.from !== null) {
    chips.push({ key: 'from', label: `Desde ${formatUtcDay(filters.from)}`, clear: { from: null } })
  }
  if (filters.to !== null) {
    chips.push({ key: 'to', label: `Hasta ${formatUtcDay(filters.to)}`, clear: { to: null } })
  }
  return chips
}

// --- Drill-down desde las filas ------------------------------------------------------------

/**
 * Filtros al pulsar un usuario de una fila: ese usuario EXACTO (`userId`) y se vacía la búsqueda por texto, que
 * sería redundante (y "ana" también encontraría a "mariana"). Se SUMA al resto de filtros activos.
 */
export function userDrillDown(userId: number): Partial<AuditLogsFilters> {
  return { userId, userName: '' }
}

/** Filtros al pulsar una acción de una fila: esa acción, sumada al resto. */
export function actionDrillDown(action: string): Partial<AuditLogsFilters> {
  return { action }
}

/**
 * Nombre del usuario filtrado por `userId`, sacado de las filas cargadas: todas son suyas, así que vale la
 * primera. `null` si no hay filas (o no hay filtro de usuario).
 */
export function filteredUserName(
  filters: Pick<AuditLogsFilters, 'userId'>,
  rows: ReadonlyArray<{ userId: number; username: string }> | undefined,
): string | null {
  if (filters.userId === null) return null
  return rows?.find((row) => row.userId === filters.userId)?.username ?? null
}

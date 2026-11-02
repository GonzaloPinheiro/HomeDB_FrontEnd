import type { LogsFilters } from './api'
import type { ErrorSummaryItem, SlowOperation } from './types'

// Lógica pura de las tarjetas de análisis de Registros (CLAUDE.md §6.23), sin React, para poder
// testearla (§9). Las constantes de "límite" reflejan al backend y se comentan con su origen.

// --- Excepciones críticas (GET /admin/logs/error-summary?hours=) --------------------------

export const ERROR_SUMMARY_RANGE_IDS = ['1h', '24h', '7d', '30d'] as const
export type ErrorSummaryRangeId = (typeof ERROR_SUMMARY_RANGE_IDS)[number]

// CLAUDE.md §5.4: el backend NO valida `hours` (`AddHours(-hours)` con un valor enorme se sale
// del rango de DateTimeOffset), así que el front solo envía estos valores fijos, nunca texto libre.
export const ERROR_SUMMARY_RANGES: Record<ErrorSummaryRangeId, { hours: number; label: string }> = {
  '1h': { hours: 1, label: '1 h' },
  '24h': { hours: 24, label: '24 h' },
  '7d': { hours: 24 * 7, label: '7 d' },
  '30d': { hours: 24 * 30, label: '30 d' },
}
/** El mismo valor por defecto que el parámetro `hours` del endpoint. */
export const DEFAULT_ERROR_SUMMARY_RANGE: ErrorSummaryRangeId = '24h'

/** `Take(10)` en LogEntryRepository.GetErrorSummaryAsync: con 10 filas puede haber más operaciones. */
export const ERROR_SUMMARY_LIMIT = 10

// --- Operaciones lentas (GET /admin/logs/slow-operations?thresholdMs=) --------------------

export const SLOW_THRESHOLD_IDS = ['500ms', '1s', '2s', '5s'] as const
export type SlowThresholdId = (typeof SLOW_THRESHOLD_IDS)[number]

export const SLOW_THRESHOLDS: Record<SlowThresholdId, { thresholdMs: number; label: string }> = {
  '500ms': { thresholdMs: 500, label: '500 ms' },
  '1s': { thresholdMs: 1000, label: '1 s' },
  '2s': { thresholdMs: 2000, label: '2 s' },
  '5s': { thresholdMs: 5000, label: '5 s' },
}
/** El mismo valor por defecto que el parámetro `thresholdMs` del endpoint. */
export const DEFAULT_SLOW_THRESHOLD: SlowThresholdId = '2s'

/**
 * `Take(50)` en LogEntryRepository.GetSlowOperationsAsync. Ojo: ese endpoint NO acota por fechas —
 * devuelve las 50 ejecuciones más lentas de TODA la tabla de logs, que no tiene política de
 * retención—, así que las más antiguas pueden tapar a las recientes.
 */
export const SLOW_OPERATIONS_LIMIT = 50
/** Filas visibles antes de "Ver todas": las 50 llenarían media pantalla. */
export const SLOW_PREVIEW_COUNT = 8

// --- Tarjetas de salud (GET /admin/logs/health) -------------------------------------------

export type HealthTone = 'ok' | 'warning' | 'critical'

/**
 * Tono de una cifra de salud: cero siempre es "ok" (verde); si hay algo, los errores son
 * críticos y los avisos solo advierten (color con propósito, §6.7).
 */
export function healthTone(severity: 'error' | 'warning', count: number): HealthTone {
  if (count <= 0) return 'ok'
  return severity === 'error' ? 'critical' : 'warning'
}

// --- Resúmenes de cabecera de las tarjetas ------------------------------------------------

/**
 * Total de excepciones críticas del resumen. Si el backend devolvió el tope (10 operaciones) puede
 * haber más operaciones fuera de la lista: el total es entonces solo una cota inferior.
 */
export function criticalTotal(items: ReadonlyArray<ErrorSummaryItem>): { total: number; isLowerBound: boolean } {
  return {
    total: items.reduce((sum, item) => sum + item.count, 0),
    isLowerBound: items.length >= ERROR_SUMMARY_LIMIT,
  }
}

/** "12 en 24 h", o "≥ 12 en 24 h" cuando el total es una cota inferior. */
export function criticalMeta(items: ReadonlyArray<ErrorSummaryItem>, rangeLabel: string): string {
  const { total, isLowerBound } = criticalTotal(items)
  return `${isLowerBound ? '≥ ' : ''}${total} en ${rangeLabel}`
}

/** "3 superan 2 s", "1 supera 2 s" o "50+ superan 2 s" (el backend corta en 50). */
export function slowMeta(count: number, thresholdLabel: string): string {
  const capped = count >= SLOW_OPERATIONS_LIMIT
  const verb = !capped && count === 1 ? 'supera' : 'superan'
  return `${capped ? `${SLOW_OPERATIONS_LIMIT}+` : count} ${verb} ${thresholdLabel}`
}

/** Anchura (0-100) de la barra de una fila respecto al máximo de la lista, no al total. */
export function barPercent(value: number, max: number): number {
  if (!(max > 0)) return 0
  return Math.min(100, Math.max(0, (value / max) * 100))
}

// --- Drill-down a la tabla de registros ---------------------------------------------------

/** Día UTC ("2026-11-02") de un timestamp ISO del backend, o null si no es una fecha válida. */
export function utcDay(isoTimestamp: string): string | null {
  const time = new Date(isoTimestamp)
  return Number.isNaN(time.getTime()) ? null : time.toISOString().slice(0, 10)
}

/**
 * Filtros de la tabla al pulsar una excepción crítica: ese nivel y esa operación, sin fechas. La
 * tarjeta cuenta en una ventana de HORAS y la tabla filtra por DÍAS UTC (§5.4), así que acotar por
 * fecha mostraría un recuento distinto al de la tarjeta; sin fechas la tabla enseña lo más
 * reciente primero, que es justo lo que se busca.
 */
export function criticalDrillDown(item: ErrorSummaryItem): Partial<LogsFilters> {
  return { level: 'Critical', operation: item.operation }
}

/**
 * Filtros de la tabla al pulsar una operación lenta: esa operación y el día UTC en que ocurrió
 * (el endpoint no devuelve el id de la entrada, así que es lo más cerca que se puede llegar).
 */
export function slowDrillDown(item: SlowOperation): Partial<LogsFilters> {
  const day = utcDay(item.timeStamp)
  return day === null ? { operation: item.operation } : { operation: item.operation, from: day, to: day }
}

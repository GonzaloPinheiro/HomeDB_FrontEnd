import { toUtcDayEnd, toUtcDayStart } from '@/shared/lib/dateRangeQuery'

import { computeBlockedPercent } from './presentation'
import type { AdBlockerHistoryPoint } from './types'

// CLAUDE.md §6.21: rango y puntos del gráfico de histórico.

export const HISTORY_RANGES = ['24h', '7d', '30d', 'custom'] as const
export type HistoryRange = (typeof HISTORY_RANGES)[number]

export const HISTORY_RANGE_LABELS: Record<HistoryRange, string> = {
  '24h': '24 h',
  '7d': '7 d',
  '30d': '30 d',
  custom: 'Personalizado',
}

/** Fechas "YYYY-MM-DD" de un `<input type="date">`; solo cuentan con el rango `custom`. */
export type HistoryQuery = { range: HistoryRange; from: string; to: string }

export type HistoryWindow = { from: string; to: string }
export type HistoryWindowResult = { ok: true; window: HistoryWindow } | { ok: false; message: string }

/**
 * Máximo del rango personalizado. Decisión de este front (no del backend): igual que
 * en el Monitor (§6.13), el backend no limita el rango, así que se acota aquí para
 * no pedir años de muestras de una vez. 92 días = un trimestre.
 */
export const MAX_CUSTOM_RANGE_DAYS = 92

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
const PRESET_SPAN_MS: Record<Exclude<HistoryRange, 'custom'>, number> = {
  '24h': DAY_MS,
  '7d': 7 * DAY_MS,
  '30d': 30 * DAY_MS,
}

/**
 * Ventana ISO (`from`/`to`) que se enviará a `GET /adblocker/history`. Los rangos fijos
 * terminan en "ahora". El personalizado ancla las fechas a UTC con `Z`
 * (`dateRangeQuery`, CLAUDE.md §5.4): una fecha "pelada" dispara un 500 en los endpoints
 * del backend que reciben `DateTimeOffset` sin normalizarlo.
 */
export function resolveHistoryWindow(query: HistoryQuery, nowMs: number): HistoryWindowResult {
  if (query.range !== 'custom') {
    return {
      ok: true,
      window: { from: new Date(nowMs - PRESET_SPAN_MS[query.range]).toISOString(), to: new Date(nowMs).toISOString() },
    }
  }
  if (query.from === '' || query.to === '') {
    return { ok: false, message: 'Elige las dos fechas del rango.' }
  }
  if (query.to < query.from) {
    // "YYYY-MM-DD" ordena igual como texto que como fecha
    return { ok: false, message: 'La fecha final debe ser igual o posterior a la inicial.' }
  }
  const days = Math.round((Date.parse(`${query.to}T00:00:00Z`) - Date.parse(`${query.from}T00:00:00Z`)) / DAY_MS) + 1
  if (days > MAX_CUSTOM_RANGE_DAYS) {
    return { ok: false, message: `El rango máximo es de ${MAX_CUSTOM_RANGE_DAYS} días.` }
  }
  return { ok: true, window: { from: toUtcDayStart(query.from), to: toUtcDayEnd(query.to) } }
}

/** Valor inicial del rango personalizado: las dos últimas semanas, en hora local. */
export function defaultCustomRange(now: Date): { from: string; to: string } {
  const toDay = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return { from: toDay(new Date(now.getTime() - 14 * DAY_MS)), to: toDay(now) }
}

export type HistoryChartPoint = AdBlockerHistoryPoint & { blockedPercent: number }

export function toChartPoints(points: readonly AdBlockerHistoryPoint[]): HistoryChartPoint[] {
  return points.map((point) => ({
    ...point,
    blockedPercent: computeBlockedPercent(point.totalQueries, point.blockedQueries),
  }))
}

/** Máximo "bonito" del eje Y (1.000, 1.500, 2.000, 3.000...) por encima de `value`. */
export function niceMax(value: number): number {
  // Mínimo 1: con todo a cero el dominio del eje sería [0, 0] y el gráfico no se dibujaría
  const safe = Math.max(value, 1)
  const step = Math.pow(10, Math.floor(Math.log10(safe))) / 2
  return Math.ceil(safe / step) * step
}

/** 12400 -> "12,4 k"; 800 -> "800". Para las marcas del eje Y. */
export function formatCompact(value: number): string {
  if (value < 1000) return String(Math.round(value))
  return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1).replace('.', ',')} k`
}

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const pad = (value: number): string => String(value).padStart(2, '0')

/**
 * Etiqueta del eje X según el rango: 24 h -> "14:30"; 7 d -> "lun 3"; el resto -> "3 nov".
 * A mano y no con `Intl` para que sea idéntica en cualquier navegador (nada de "nov.").
 */
export function formatAxisTick(iso: string, range: HistoryRange): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  if (range === '24h') return `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (range === '7d') return `${DAYS[date.getDay()]} ${date.getDate()}`
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`
}

/**
 * Marcas del eje X. En 24 h basta con que recharts reparta las suyas (devuelve `undefined`).
 * En el resto de rangos hay varios puntos por día y la etiqueta solo dice el día, así que
 * recharts repetiría "lun 26, lun 26...": se elige el primer punto de cada día y, si son
 * demasiados (rangos largos), se aclaran a `maxTicks` repartidas por igual.
 */
export function pickAxisTicks(
  points: readonly { timestamp: string }[],
  range: HistoryRange,
  maxTicks = 8,
): string[] | undefined {
  if (range === '24h') return undefined
  const firstOfEachDay: string[] = []
  let previousLabel = ''
  for (const point of points) {
    const label = formatAxisTick(point.timestamp, range)
    if (label !== previousLabel) firstOfEachDay.push(point.timestamp)
    previousLabel = label
  }
  if (firstOfEachDay.length <= maxTicks) return firstOfEachDay
  const stride = Math.ceil(firstOfEachDay.length / maxTicks)
  return firstOfEachDay.filter((_, index) => index % stride === 0)
}

/** Título del tooltip: "Hoy · 14:30", "lun 3 nov · 14:00" o (rango largo) "lun 3 nov". */
export function formatTooltipTitle(iso: string, range: HistoryRange): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (range === '24h') return `Hoy · ${time}`
  const day = `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`
  return range === 'custom' ? day : `${day} · ${time}`
}

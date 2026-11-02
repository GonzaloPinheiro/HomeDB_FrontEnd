// Serie de actividad por día de Auditoría (CLAUDE.md §6.24). Puro, para poder testearlo (§9). Todos los días son
// días UTC ("AAAA-MM-DD"), como los filtros de fecha del backend (§5.4).

export const ACTIVITY_RANGE_IDS = ['7d', '30d'] as const
export type ActivityRangeId = (typeof ACTIVITY_RANGE_IDS)[number]

export const ACTIVITY_RANGES: Record<ActivityRangeId, { days: number; label: string }> = {
  '7d': { days: 7, label: '7 d' },
  '30d': { days: 30, label: '30 d' },
}
export const DEFAULT_ACTIVITY_RANGE: ActivityRangeId = '7d'

export type ActivityWindow = { from: string; to: string }
export type ActivityPoint = { date: string; count: number }

const DAY_MS = 86_400_000

function toDay(timeMs: number): string {
  return new Date(timeMs).toISOString().slice(0, 10)
}

/**
 * Los últimos `days` días UTC, hasta HOY incluido: 7 días = hoy y los 6 anteriores. `now` es inyectable solo para
 * los tests.
 */
export function activityWindow(days: number, now: number = Date.now()): ActivityWindow {
  const today = Date.parse(`${toDay(now)}T00:00:00Z`)
  return { from: toDay(today - (days - 1) * DAY_MS), to: toDay(today) }
}

/**
 * Serie densa: un punto por cada día de la ventana, con 0 donde el backend no devolvió nada (puede omitir los
 * días sin actividad). Ignora los días fuera de la ventana y suma los duplicados.
 */
export function fillDailySeries(
  daily: ReadonlyArray<{ date: string; count: number }>,
  window: ActivityWindow,
): ActivityPoint[] {
  const counts = new Map<string, number>()
  for (const point of daily) counts.set(point.date, (counts.get(point.date) ?? 0) + point.count)

  const series: ActivityPoint[] = []
  const end = Date.parse(`${window.to}T00:00:00Z`)
  for (let time = Date.parse(`${window.from}T00:00:00Z`); time <= end; time += DAY_MS) {
    const date = toDay(time)
    series.push({ date, count: counts.get(date) ?? 0 })
  }
  return series
}

/** Total de acciones de la serie y el día de mayor actividad (el primero si hay empate); `null` si no hay ninguna. */
export function summarizeActivity(series: ReadonlyArray<ActivityPoint>): { total: number; peak: ActivityPoint | null } {
  let total = 0
  let peak: ActivityPoint | null = null
  for (const point of series) {
    total += point.count
    if (point.count > 0 && (peak === null || point.count > peak.count)) peak = point
  }
  return { total, peak }
}

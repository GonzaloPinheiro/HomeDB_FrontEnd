import type { LogsFilters } from './api'

// Filtros de la tabla de Registros <-> query params de la URL (CLAUDE.md §7.10). Funciones puras sobre
// `URLSearchParams` (sin React Router) para poder testearlas (§9); el hook `useLogsFilters` las conecta
// a la URL.

const FILTER_KEYS = ['level', 'operation', 'from', 'to', 'correlationId'] as const satisfies ReadonlyArray<
  keyof LogsFilters
>
const PAGE_KEY = 'page'

/** Un parámetro vacío (`?level=`) cuenta como ausente: nunca se envía al backend como filtro. */
function readParam(params: URLSearchParams, key: string): string | null {
  const value = params.get(key)
  return value === null || value === '' ? null : value
}

export function parseLogsFilters(params: URLSearchParams): LogsFilters {
  return {
    level: readParam(params, 'level'),
    operation: readParam(params, 'operation') ?? '',
    from: readParam(params, 'from'),
    to: readParam(params, 'to'),
    correlationId: readParam(params, 'correlationId'),
  }
}

/** Página de la URL: entero >= 1; cualquier otra cosa (texto, 0, negativos, decimales) se corrige. */
export function parsePage(params: URLSearchParams): number {
  const parsed = Number(params.get(PAGE_KEY))
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1
}

export function countActiveFilters(filters: LogsFilters): number {
  return FILTER_KEYS.filter((key) => filters[key] !== null && filters[key] !== '').length
}

/** Copia de `current` con `patch` aplicado: `null` o `''` borran el parámetro. */
export function patchParams(
  current: URLSearchParams,
  patch: Readonly<Record<string, string | null>>,
): URLSearchParams {
  const next = new URLSearchParams(current)
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === '') next.delete(key)
    else next.set(key, value)
  }
  return next
}

/**
 * Copia de `current` en la que los filtros pasan a ser EXACTAMENTE `filters` (y la página vuelve a la
 * primera). Los parámetros que no son de esta tabla —p. ej. `?settings=` del modal de ajustes, §6.20— se
 * conservan.
 */
export function replaceFilterParams(
  current: URLSearchParams,
  filters: Partial<LogsFilters>,
): URLSearchParams {
  const next = new URLSearchParams(current)
  next.delete(PAGE_KEY)
  for (const key of FILTER_KEYS) {
    const value = filters[key]
    if (value === undefined || value === null || value === '') next.delete(key)
    else next.set(key, value)
  }
  return next
}

import type { UrlFiltersConfig } from '@/shared/hooks/useUrlFilters'
import { readParam } from '@/shared/lib/searchParams'

import type { LogsFilters } from './api'

// Filtros de la tabla de Registros <-> query params de la URL (CLAUDE.md §7.10). La mecánica común
// (página, `replace`, drill-down, campo con retardo) está en `useUrlFilters`; aquí solo lo propio de
// esta tabla. Puro, para poder testearlo (§9).

export function parseLogsFilters(params: URLSearchParams): LogsFilters {
  return {
    level: readParam(params, 'level'),
    operation: readParam(params, 'operation') ?? '',
    from: readParam(params, 'from'),
    to: readParam(params, 'to'),
    correlationId: readParam(params, 'correlationId'),
  }
}

export const LOGS_FILTERS_CONFIG: UrlFiltersConfig<LogsFilters> = {
  parse: parseLogsFilters,
  keys: ['level', 'operation', 'from', 'to', 'correlationId'],
  textKey: 'operation',
}

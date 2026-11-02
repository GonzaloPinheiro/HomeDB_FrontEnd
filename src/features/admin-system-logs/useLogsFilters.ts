import { useUrlFilters, type UrlFiltersState } from '@/shared/hooks/useUrlFilters'

import type { LogsFilters } from './api'
import { LOGS_FILTERS_CONFIG } from './filters'

/** Estado de la tabla de Registros en la URL (CLAUDE.md §7.10); la mecánica es la de `useUrlFilters`. */
export function useLogsFilters() {
  return useUrlFilters(LOGS_FILTERS_CONFIG)
}

/** Lo que devuelve `useLogsFilters`: se pasa a los componentes que pintan la tabla y sus filtros. */
export type LogsFiltersState = UrlFiltersState<LogsFilters>

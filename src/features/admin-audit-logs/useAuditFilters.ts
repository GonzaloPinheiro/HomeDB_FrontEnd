import { useUrlFilters, type UrlFiltersState } from '@/shared/hooks/useUrlFilters'

import type { AuditLogsFilters } from './api'
import { AUDIT_FILTERS_CONFIG } from './filters'

/** Estado de la tabla de Auditoría en la URL (CLAUDE.md §7.10); la mecánica es la de `useUrlFilters`. */
export function useAuditFilters() {
  return useUrlFilters(AUDIT_FILTERS_CONFIG)
}

/** Lo que devuelve `useAuditFilters`: se pasa a los componentes que pintan la tabla y sus filtros. */
export type AuditFiltersState = UrlFiltersState<AuditLogsFilters>

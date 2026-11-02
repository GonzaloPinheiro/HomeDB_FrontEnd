import type { UrlFiltersConfig } from '@/shared/hooks/useUrlFilters'
import { readIntParam, readParam } from '@/shared/lib/searchParams'

import type { AuditLogsFilters } from './api'

// Filtros de la tabla de Auditoría <-> query params de la URL (CLAUDE.md §7.10). La mecánica común está en
// `useUrlFilters`; aquí solo lo propio de esta tabla. Puro, para poder testearlo (§9).

export function parseAuditFilters(params: URLSearchParams): AuditLogsFilters {
  return {
    userName: readParam(params, 'userName') ?? '',
    // Un id que no es un entero positivo (`?userId=abc`) se ignora en vez de llegar al backend
    userId: readIntParam(params, 'userId'),
    action: readParam(params, 'action'),
    resourceType: readParam(params, 'resourceType'),
    from: readParam(params, 'from'),
    to: readParam(params, 'to'),
  }
}

export const AUDIT_FILTERS_CONFIG: UrlFiltersConfig<AuditLogsFilters> = {
  parse: parseAuditFilters,
  keys: ['userName', 'userId', 'action', 'resourceType', 'from', 'to'],
  textKey: 'userName',
}

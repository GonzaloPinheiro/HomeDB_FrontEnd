import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/shared/api/client'
import { toUtcDayEnd, toUtcDayStart } from '@/shared/lib/dateRangeQuery'
import type { ApiObjResponse } from '@/shared/types/api'

import { auditLogsPageSchema } from './types'

export const AUDIT_LOGS_PAGE_SIZE = 20

export type AuditLogsFilters = {
  userName: string
  action: string | null
  resourceType: string | null
  from: string | null
  to: string | null
}

export const EMPTY_AUDIT_FILTERS: AuditLogsFilters = {
  userName: '',
  action: null,
  resourceType: null,
  from: null,
  to: null,
}

// La clave incluye TODOS los filtros y la página (mismo patrón que
// admin-users/api.ts y admin-system-logs/api.ts).
export const auditLogsKeys = {
  all: ['admin-audit-logs'] as const,
  list: (filters: AuditLogsFilters, page: number) => ['admin-audit-logs', 'list', filters, page] as const,
}

/**
 * GET /admin/audit-logs — CLAUDE.md §5.4: GetAuditLogsRequestDto.userName
 * lleva minúscula real en el backend (única propiedad así, resto PascalCase),
 * verificado en la auditoría de Fase 5 — no es un typo de este front, replica
 * el nombre real de la propiedad C#.
 */
export function useAuditLogs(filters: AuditLogsFilters, page: number) {
  return useQuery({
    queryKey: auditLogsKeys.list(filters, page),
    queryFn: async () => {
      const response = await api.get<ApiObjResponse<unknown>>('/admin/audit-logs', {
        params: {
          userName: filters.userName || undefined,
          action: filters.action ?? undefined,
          resourceType: filters.resourceType ?? undefined,
          // §5.4 (Fase 5): UTC explícito — evita el 500 de DateTimeOffset/Npgsql
          from: filters.from ? toUtcDayStart(filters.from) : undefined,
          to: filters.to ? toUtcDayEnd(filters.to) : undefined,
          page,
          pageSize: AUDIT_LOGS_PAGE_SIZE,
        },
      })
      return auditLogsPageSchema.parse(unwrap(response.data))
    },
    // Mantiene la página anterior visible mientras llega la nueva (sin saltos)
    placeholderData: keepPreviousData,
  })
}

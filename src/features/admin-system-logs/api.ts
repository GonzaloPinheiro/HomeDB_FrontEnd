import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/shared/api/client'
import { toUtcDayEnd, toUtcDayStart } from '@/shared/lib/dateRangeQuery'
import type { ApiObjResponse } from '@/shared/types/api'

import { logHealthSchema, logsPageSchema } from './types'

export const LOGS_PAGE_SIZE = 20

export type LogsFilters = {
  level: string | null
  operation: string
  from: string | null
  to: string | null
  correlationId: string | null
}

export const EMPTY_LOGS_FILTERS: LogsFilters = {
  level: null,
  operation: '',
  from: null,
  to: null,
  correlationId: null,
}

// La clave incluye TODOS los filtros y la página (mismo patrón que
// admin-users/api.ts, Fase 4a): cada combinación cachea por separado.
export const logsKeys = {
  all: ['admin-logs'] as const,
  list: (filters: LogsFilters, page: number) => ['admin-logs', 'list', filters, page] as const,
  health: ['admin-logs', 'health'] as const,
}

export function useLogs(filters: LogsFilters, page: number) {
  return useQuery({
    queryKey: logsKeys.list(filters, page),
    queryFn: async () => {
      const response = await api.get<ApiObjResponse<unknown>>('/admin/logs', {
        params: {
          level: filters.level ?? undefined,
          operation: filters.operation || undefined,
          // §5.4 (Fase 5): UTC explícito — evita el 500 de DateTimeOffset/Npgsql
          from: filters.from ? toUtcDayStart(filters.from) : undefined,
          to: filters.to ? toUtcDayEnd(filters.to) : undefined,
          correlationId: filters.correlationId ?? undefined,
          page,
          pageSize: LOGS_PAGE_SIZE,
        },
      })
      return logsPageSchema.parse(unwrap(response.data))
    },
    // Mantiene la página anterior visible mientras llega la nueva (sin saltos)
    placeholderData: keepPreviousData,
  })
}

/**
 * GET /admin/logs/health — resumen de la cabecera (§6.6: 3 cifras simples).
 * CLAUDE.md §5.4 lo documenta como 3 contadores funcionales; verificado en la
 * auditoría de Fase 5 que `ErrorsLastHour`/`ErrorsLast24h` cuentan Level ==
 * "Error" en el backend, un valor que ningún código del backend escribe hoy
 * (solo escribe "Information"/"Warning"/"Critical") — esos dos contadores
 * siempre devuelven 0 en la práctica. Es un bug del backend, no de este front;
 * se muestra tal cual devuelve la API (ver informe de Fase 5).
 */
export function useLogsHealth() {
  return useQuery({
    queryKey: logsKeys.health,
    queryFn: async () => {
      const response = await api.get<ApiObjResponse<unknown>>('/admin/logs/health')
      return logHealthSchema.parse(unwrap(response.data))
    },
  })
}

import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/shared/api/client'
import { toUtcDayEnd, toUtcDayStart } from '@/shared/lib/dateRangeQuery'
import type { ApiObjResponse } from '@/shared/types/api'

import { errorSummarySchema, logHealthSchema, logsPageSchema, slowOperationsSchema } from './types'

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
  errorSummary: (hours: number) => ['admin-logs', 'error-summary', hours] as const,
  slowOperations: (thresholdMs: number) => ['admin-logs', 'slow-operations', thresholdMs] as const,
}

// Los dos análisis recorren la tabla de logs entera —sin índices sobre `Logs` ni política de retención en
// el backend (§5.4)—, así que no se repiten al volver a la pantalla ni al cambiar de chip y volver. El
// botón "Refrescar" los fuerza (invalida `logsKeys.all`).
const INSIGHT_STALE_TIME_MS = 60_000

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
 * GET /admin/logs/health — resumen de la cabecera (§6.23: 3 tarjetas). `errorsLastHour`/`errorsLast24h`
 * cuentan entradas de nivel `Error` (NO `Critical`, que va aparte en `useErrorSummary`) y
 * `warningsLast24h` las de nivel `Warning`. En la auditoría de Fase 5 los dos primeros valían siempre 0
 * porque ningún código escribía `Error`; releído en noviembre 2026, el backend ya lo escribe (§5.4) y
 * los contadores funcionan.
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

/**
 * GET /admin/logs/error-summary?hours= — top 10 de operaciones con excepciones no controladas
 * (nivel `Critical`) en las últimas `hours` horas. `hours` debe salir de `ERROR_SUMMARY_RANGES`
 * (presentation.ts): el backend no lo valida.
 */
export function useErrorSummary(hours: number) {
  return useQuery({
    queryKey: logsKeys.errorSummary(hours),
    queryFn: async () => {
      const response = await api.get<ApiObjResponse<unknown>>('/admin/logs/error-summary', {
        params: { hours },
      })
      return errorSummarySchema.parse(unwrap(response.data))
    },
    staleTime: INSIGHT_STALE_TIME_MS,
    // Al cambiar de rango se queda el anterior (atenuado) en vez de saltar a un skeleton
    placeholderData: keepPreviousData,
  })
}

/**
 * GET /admin/logs/slow-operations?thresholdMs= — las 50 ejecuciones más lentas por encima del umbral,
 * ordenadas de más a menos lenta. **Sin ventana temporal**: abarca toda la tabla de logs (§5.4).
 * `thresholdMs` debe salir de `SLOW_THRESHOLDS` (presentation.ts).
 */
export function useSlowOperations(thresholdMs: number) {
  return useQuery({
    queryKey: logsKeys.slowOperations(thresholdMs),
    queryFn: async () => {
      const response = await api.get<ApiObjResponse<unknown>>('/admin/logs/slow-operations', {
        params: { thresholdMs },
      })
      return slowOperationsSchema.parse(unwrap(response.data))
    },
    staleTime: INSIGHT_STALE_TIME_MS,
    placeholderData: keepPreviousData,
  })
}

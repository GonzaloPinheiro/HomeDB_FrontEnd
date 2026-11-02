import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/shared/api/client'
import { toUtcDayEnd, toUtcDayStart } from '@/shared/lib/dateRangeQuery'
import type { ApiObjResponse } from '@/shared/types/api'

import { SENSITIVE_ACTIONS } from './actions'
import { activityWindow, fillDailySeries, type ActivityPoint } from './activity'
import { auditActivitySchema, auditLogsPageSchema, userSuggestionsSchema } from './types'

export const AUDIT_LOGS_PAGE_SIZE = 20

export type AuditLogsFilters = {
  /** Búsqueda por texto (subcadena del nombre de usuario). Distinta de `userId`, que es exacto. */
  userName: string
  /** Usuario exacto (`GetAuditLogsRequestDto.UserId`). Hasta §6.24 el front no lo usaba. */
  userId: number | null
  action: string | null
  resourceType: string | null
  from: string | null
  to: string | null
}

export const EMPTY_AUDIT_FILTERS: AuditLogsFilters = {
  userName: '',
  userId: null,
  action: null,
  resourceType: null,
  from: null,
  to: null,
}

/** Ventana de las tarjetas de resumen, en horas. */
export const SUMMARY_WINDOW_HOURS = 24

// La clave incluye TODOS los filtros y la página (mismo patrón que
// admin-users/api.ts y admin-system-logs/api.ts).
export const auditLogsKeys = {
  all: ['admin-audit-logs'] as const,
  list: (filters: AuditLogsFilters, page: number) => ['admin-audit-logs', 'list', filters, page] as const,
  count: (action: string | null, hours: number) => ['admin-audit-logs', 'count', action, hours] as const,
  users: (term: string) => ['admin-audit-logs', 'users', term] as const,
  activity: (days: number) => ['admin-audit-logs', 'activity', days] as const,
}

// Las tarjetas de resumen no cambian entre un vistazo y el siguiente; el botón "Refrescar" las fuerza.
const SUMMARY_STALE_TIME_MS = 60_000

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
          userId: filters.userId ?? undefined,
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

/**
 * Cuántas entradas de auditoría hay en las últimas `hours` horas (de la acción dada, o de todas con `null`):
 * una petición de UNA fila cuyo `totalCount` es la cifra. El backend no tiene endpoint de estadísticas
 * (§5.4); si lo tuviera (`useAuditActivity`, §6.24) esto sobraría.
 *
 * `from` se calcula al ejecutar la consulta, NO en la clave: así la clave es estable (la caché sirve) y cada
 * petición mide "las últimas 24 h" desde ese momento. Lleva hora exacta con `Z` —`From` es `DateTimeOffset`—,
 * a diferencia de los filtros de día de la tabla.
 */
async function fetchAuditCount(action: string | null, hours: number): Promise<number> {
  const response = await api.get<ApiObjResponse<unknown>>('/admin/audit-logs', {
    params: {
      action: action ?? undefined,
      from: new Date(Date.now() - hours * 3_600_000).toISOString(),
      page: 1,
      pageSize: 1,
    },
  })
  return auditLogsPageSchema.parse(unwrap(response.data)).totalCount
}

export type AuditSummary = {
  isPending: boolean
  /** Todas las acciones. `undefined` = sin dato (cargando o fallido). */
  total: number | undefined
  logins: number | undefined
  /** Una entrada por acción sensible (altas, cambios de contraseña, usuarios eliminados). */
  sensitive: Array<{ action: string; count: number | undefined }>
}

/**
 * Cifras de las tarjetas de Auditoría: 5 peticiones de una fila (todas, inicios de sesión y una por cada acción
 * sensible, porque el backend filtra `action` por subcadena y no admite varias a la vez, §5.4).
 */
export function useAuditSummary(): AuditSummary {
  const actions: Array<string | null> = [null, 'LOGIN', ...SENSITIVE_ACTIONS]
  const results = useQueries({
    queries: actions.map((action) => ({
      queryKey: auditLogsKeys.count(action, SUMMARY_WINDOW_HOURS),
      queryFn: () => fetchAuditCount(action, SUMMARY_WINDOW_HOURS),
      staleTime: SUMMARY_STALE_TIME_MS,
    })),
  })

  // `data` y no `isError` (§7.1): un refetch fallido deja el último dato visible
  return {
    isPending: results.some((result) => result.isPending),
    total: results[0].data,
    logins: results[1].data,
    sensitive: SENSITIVE_ACTIONS.map((action, index) => ({ action, count: results[2 + index].data })),
  }
}

export const USER_SUGGESTIONS_LIMIT = 6

/**
 * GET /admin/users — sugerencias para elegir un usuario exacto en el filtro (§6.24). Exige el módulo
 * `UserManagement` (§5.4): quien llama debe pasar `enabled: false` si no lo tiene, para no disparar un 403.
 */
export function useUserSuggestions(term: string, enabled: boolean) {
  const trimmed = term.trim()
  return useQuery({
    queryKey: auditLogsKeys.users(trimmed),
    enabled: enabled && trimmed.length > 0,
    queryFn: async () => {
      const response = await api.get<ApiObjResponse<unknown>>('/admin/users', {
        params: { userName: trimmed, page: 1, pageSize: USER_SUGGESTIONS_LIMIT },
      })
      return userSuggestionsSchema.parse(unwrap(response.data)).users
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

/**
 * PENDIENTE (CLAUDE.md §5.4, §6.24): `GET /admin/audit-logs/activity` NO existe en el backend todavía. Con `false`
 * no se pinta la tarjeta de actividad por día ni se hace ninguna petición. Para activarlo: releer el backend, documentar
 * el contrato real en §5.4, ajustar `auditActivitySchema` (types.ts) y actualizar `api.test.tsx`, que fija el `false` a
 * propósito para que activarlo sea una decisión consciente. Mismo patrón que `FILE_MOVE_ENABLED` y `THUMBNAILS_ENABLED`.
 */
export const AUDIT_ACTIVITY_ENABLED = false

/**
 * Actividad por día de las últimas `rangeDays` jornadas UTC, ya rellena (los días sin actividad, a 0). La ventana
 * se calcula al ejecutar la consulta —no en la clave— y es la misma con la que se rellena la serie, así que
 * petición y gráfico no pueden divergir. `enabled` es un parámetro solo para poder probar la ruta activa.
 */
export function useAuditActivity(rangeDays: number, enabled: boolean = AUDIT_ACTIVITY_ENABLED) {
  return useQuery({
    queryKey: auditLogsKeys.activity(rangeDays),
    enabled,
    queryFn: async (): Promise<ActivityPoint[]> => {
      const window = activityWindow(rangeDays)
      const response = await api.get<ApiObjResponse<unknown>>('/admin/audit-logs/activity', {
        params: { from: toUtcDayStart(window.from), to: toUtcDayEnd(window.to) },
      })
      return fillDailySeries(auditActivitySchema.parse(unwrap(response.data)).daily, window)
    },
    staleTime: SUMMARY_STALE_TIME_MS,
    placeholderData: keepPreviousData,
  })
}

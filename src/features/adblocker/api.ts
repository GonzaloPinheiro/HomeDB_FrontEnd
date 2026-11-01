import { useMutation, useQuery } from '@tanstack/react-query'

import { ApiError, shouldRetryQuery } from '@/shared/api/client'

import { getAdBlockerFailure, isDeterministicFailure } from './failures'
import { resolveHistoryWindow, type HistoryQuery } from './history'
import {
  checkDomain,
  getAlertSettings,
  getHistory,
  getStats,
  getStatus,
  listAllowlist,
  listBlockedServices,
  listFilterLists,
} from './mock/mockApi'

// CLAUDE.md §6.21, §7.1: único punto de acceso a datos de AdGuard — los componentes solo
// conocen estos hooks. Solo hay lecturas: las acciones de escritura (pausar, permitidos,
// servicios, alertas) no tienen mutation todavía; sus botones avisan con `notAvailableYet`.
// PENDIENTE (CLAUDE.md §6.21): hoy leen de `./mock/mockApi` porque el backend aún no tiene
// la integración con AdGuard. Al implementarla:
//   1. Releer el código real del backend (§2) y documentar los endpoints en §5.4.
//   2. Sustituir cada `queryFn` por la llamada real con `api` + `unwrap` + schema de Zod
//      (`schemas.ts`), y ajustar `types.ts` a la forma real.
//   3. Añadir las mutations (con invalidación de la query afectada) y conectar los botones.
//   4. `refetchInterval` de `status` y `stats` (~60 s, como el Monitor, §7.9) cuidando el
//      rate limit global (§7.4). Al caducar una pausa, invalidar `status` en vez de asumir
//      el cambio con el reloj del navegador.
//   5. Borrar la carpeta `mock/` y el `<MockBadge />` de la cabecera.
// Los componentes no deberían necesitar ningún cambio.

export const adBlockerKeys = {
  all: ['adblocker'] as const,
  status: () => [...adBlockerKeys.all, 'status'] as const,
  stats: () => [...adBlockerKeys.all, 'stats'] as const,
  // Los rangos fijos se calculan al pedirlos (terminan en "ahora"): la clave solo lleva el
  // rango. El personalizado añade sus fechas.
  history: (query: HistoryQuery) =>
    [...adBlockerKeys.all, 'history', query.range, ...(query.range === 'custom' ? [query.from, query.to] : [])] as const,
  allowlist: () => [...adBlockerKeys.all, 'allowlist'] as const,
  services: () => [...adBlockerKeys.all, 'services'] as const,
  filterLists: () => [...adBlockerKeys.all, 'filter-lists'] as const,
  alerts: () => [...adBlockerKeys.all, 'alerts'] as const,
}

// Un fallo determinista (sin configurar, credenciales, inalcanzable, 403) no se arregla
// reintentando: se enseña enseguida en vez de tras tres reintentos. El resto, como siempre.
function retryAdBlockerQuery(failureCount: number, error: Error): boolean {
  if (isDeterministicFailure(getAdBlockerFailure(error))) return false
  // Un 4xx tampoco se repite (§5.1; el 429 gastaría más cupo del limitador global). Con la API
  // real llega como error de axios y ya lo cubre `shouldRetryQuery`; un `ApiError` ya
  // convertido (p. ej. el de la maqueta) hay que mirarlo por su estado HTTP.
  if (error instanceof ApiError && error.httpStatus !== null && error.httpStatus >= 400 && error.httpStatus < 500) {
    return false
  }
  return shouldRetryQuery(failureCount, error)
}

export function useAdBlockerStatus() {
  return useQuery({ queryKey: adBlockerKeys.status(), queryFn: getStatus, retry: retryAdBlockerQuery })
}

export function useAdBlockerStats() {
  return useQuery({ queryKey: adBlockerKeys.stats(), queryFn: getStats, retry: retryAdBlockerQuery })
}

/**
 * `enabled` permite no pedir nada mientras el rango personalizado no sea válido: el
 * componente ya muestra el motivo, y no tiene sentido gastar una petición.
 */
export function useAdBlockerHistory(query: HistoryQuery, enabled: boolean) {
  return useQuery({
    queryKey: adBlockerKeys.history(query),
    queryFn: () => {
      const result = resolveHistoryWindow(query, Date.now())
      if (!result.ok) throw new Error(result.message)
      return getHistory(result.window.from, result.window.to)
    },
    enabled,
    retry: retryAdBlockerQuery,
  })
}

export function useAllowlist() {
  return useQuery({ queryKey: adBlockerKeys.allowlist(), queryFn: listAllowlist, retry: retryAdBlockerQuery })
}

export function useBlockedServices() {
  return useQuery({ queryKey: adBlockerKeys.services(), queryFn: listBlockedServices, retry: retryAdBlockerQuery })
}

export function useFilterLists() {
  return useQuery({ queryKey: adBlockerKeys.filterLists(), queryFn: listFilterLists, retry: retryAdBlockerQuery })
}

export function useAlertSettings() {
  return useQuery({ queryKey: adBlockerKeys.alerts(), queryFn: getAlertSettings, retry: retryAdBlockerQuery })
}

/**
 * Comprobar un dominio es una lectura, pero la dispara el usuario con un botón y su
 * resultado es efímero (no se cachea por dominio): encaja mejor como mutation, con su
 * propio estado pendiente/resultado/error y `reset()` para volver al inicio.
 */
export function useCheckDomain() {
  return useMutation({ mutationFn: checkDomain })
}

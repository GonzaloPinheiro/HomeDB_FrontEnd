import { useQuery } from '@tanstack/react-query'

import { ApiError, shouldRetryQuery } from '@/shared/api/client'

import { getVpnFailure, isDeterministicFailure } from './failures'
import { getSnapshot, listOwners } from './mock/mockApi'

// CLAUDE.md §6.22, §7.1: único punto de acceso a datos de la VPN — los componentes solo conocen
// estos hooks. Solo hay lecturas: las escrituras (guardar dueño y notas, revocar) no tienen
// mutation todavía; sus botones avisan con `notAvailableYet`.
// PENDIENTE (CLAUDE.md §6.22): hoy leen de `./mock/mockApi` porque el backend aún no tiene la
// gestión de la VPN. Al implementarla:
//   1. Releer el código real del backend (§2) y documentar los endpoints en §5.4.
//   2. Sustituir cada `queryFn` por la llamada real con `api` + `unwrap` + schema de Zod
//      (`schemas.ts`), y ajustar `types.ts` a la forma real.
//   3. Añadir las mutations (guardar dueño y notas: PATCH; revocar: POST con 202) con invalidación
//      de `vpnKeys.devices()`. La clave pública tiene `/`, `+` y `=`: NO va en la ruta tal cual
//      (hay que codificarla o mandarla en el cuerpo). Manejar sus errores en el modal de
//      revocación: 404 (ya no existe), 429 (límite propio de ~10 revocaciones por minuto).
//   4. Los dueños (`useVpnOwners`) saldrán de la lista de usuarios de HomeDB, no de aquí.
//   5. Borrar la carpeta `mock/` y el `<MockBadge />` de `VpnHeader`.
// Los componentes no deberían necesitar ningún cambio.

export const vpnKeys = {
  all: ['vpn'] as const,
  devices: () => [...vpnKeys.all, 'devices'] as const,
  owners: () => [...vpnKeys.all, 'owners'] as const,
}

/** La pantalla vuelve a pedir la lectura cada minuto: coincide con el ciclo del temporizador del host. */
export const VPN_REFETCH_INTERVAL_MS = 60_000

// Un fallo determinista no se arregla reintentando: se enseña enseguida. Un 4xx tampoco se
// repite (§5.1; el 429 gastaría más cupo del limitador global). Con la API real llega como
// error de axios y ya lo cubre `shouldRetryQuery`; un `ApiError` ya convertido (p. ej. el de la
// maqueta) hay que mirarlo por su estado HTTP.
function retryVpnQuery(failureCount: number, error: Error): boolean {
  if (isDeterministicFailure(getVpnFailure(error))) return false
  if (error instanceof ApiError && error.httpStatus !== null && error.httpStatus >= 400 && error.httpStatus < 500) {
    return false
  }
  return shouldRetryQuery(failureCount, error)
}

export function useVpnDevices() {
  return useQuery({
    queryKey: vpnKeys.devices(),
    queryFn: getSnapshot,
    retry: retryVpnQuery,
    refetchInterval: VPN_REFETCH_INTERVAL_MS,
  })
}

/** Solo se piden cuando ya hay lectura de dispositivos: sin ella la pantalla ni siquiera se ve. */
export function useVpnOwners(enabled: boolean) {
  return useQuery({ queryKey: vpnKeys.owners(), queryFn: listOwners, retry: retryVpnQuery, enabled })
}

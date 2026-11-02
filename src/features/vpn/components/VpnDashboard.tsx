import { Lock, SearchX } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { toApiError } from '@/shared/api/client'
import { EmptyState } from '@/shared/components/EmptyState'
import { Button } from '@/shared/components/ui/button'
import { useNow } from '@/shared/hooks/useNow'

import { useVpnDevices, useVpnOwners } from '../api'
import { getVpnFailure } from '../failures'
import {
  DEFAULT_FILTERS,
  countByStatus,
  filterByQueryAndOwner,
  filterByStatus,
  hasActiveFilters,
  sortDevices,
  type DeviceFilters,
  type DeviceSort,
} from '../filters'
import {
  describeSummary,
  findCompletedRevocations,
  formatAgo,
  getSnapshotAgeMs,
  isRevocationOverdue,
  isSnapshotStale,
  summarizeDevices,
} from '../presentation'
import type { VpnDevice } from '../types'
import { DEVICE_CARD_ATTRIBUTE, DeviceCard } from './DeviceCard'
import { DeviceDetailModal } from './DeviceDetailModal'
import { VpnBanner } from './VpnBanner'
import { VpnFailureCard } from './VpnFailureCard'
import { VpnHeader } from './VpnHeader'
import { VpnSkeleton } from './VpnSkeleton'
import { VpnToolbar } from './VpnToolbar'

// CLAUDE.md §6.22: pantalla de la VPN (solo Admin, ver el guard de la ruta), variante B:
// cuadrícula de tarjetas con el estado en primer plano y el detalle en un modal.
// PENDIENTE (CLAUDE.md §6.22): maqueta — ver `api.ts` para lo que falta al llegar el backend.
export function VpnDashboard() {
  const devicesQuery = useVpnDevices()
  const snapshot = devicesQuery.data
  const ownersQuery = useVpnOwners(snapshot !== undefined)
  const now = useNow(true)

  const [filters, setFilters] = useState<DeviceFilters>(DEFAULT_FILTERS)
  const [sort, setSort] = useState<DeviceSort>('name')
  // La clave se conserva al cerrar el detalle (`detailOpen`), para que no se vacíe durante el fundido
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const devices = useMemo(() => snapshot?.devices ?? [], [snapshot])

  // Una revocación es asíncrona: la única señal de que terminó es que el dispositivo desaparece de la
  // lectura siguiente. Se avisa entonces.
  const previousDevices = useRef<VpnDevice[]>([])
  useEffect(() => {
    if (snapshot === undefined) return
    for (const name of findCompletedRevocations(previousDevices.current, snapshot.devices)) {
      toast.success(`«${name}» revocado. Ya no tiene acceso a la VPN.`)
    }
    previousDevices.current = snapshot.devices
  }, [snapshot])

  const baseDevices = useMemo(() => filterByQueryAndOwner(devices, filters), [devices, filters])
  const counts = useMemo(() => countByStatus(baseDevices), [baseDevices])
  const visible = useMemo(
    () => sortDevices(filterByStatus(baseDevices, filters.status), sort),
    [baseDevices, filters.status, sort],
  )
  const selected = selectedKey === null ? undefined : devices.find((device) => device.publicKey === selectedKey)

  const refresh = async () => {
    const previousSnapshotAt = snapshot?.snapshotAt
    const result = await devicesQuery.refetch()
    // Pedir de nuevo no genera una lectura nueva: si el temporizador del host está parado, llega la misma
    if (result.data !== undefined && result.data.snapshotAt === previousSnapshotAt) {
      toast.warning('No hay datos nuevos: el servidor no ha generado otra lectura')
    }
  }

  const openDetail = (device: VpnDevice) => {
    setSelectedKey(device.publicKey)
    setDetailOpen(true)
  }

  // §11: Radix solo devuelve el foco a un DialogTrigger; el detalle se abre desde una tarjeta
  const returnFocusToCard = (event: Event) => {
    event.preventDefault()
    if (selectedKey === null) return
    document.querySelector<HTMLElement>(`[${DEVICE_CARD_ATTRIBUTE}="${selectedKey}"]`)?.focus()
  }

  // `data === undefined` y no `isError` (§7.1): un refetch fallido deja la última lectura visible
  const failed = !devicesQuery.isPending && snapshot === undefined
  const overdueRevocations = devices.filter((device) => isRevocationOverdue(device, now))

  return (
    <div className="flex min-h-full flex-col gap-[22px] px-4 py-6 sm:px-8 sm:py-[26px]">
      <VpnHeader snapshot={snapshot} nowMs={now} refreshing={devicesQuery.isFetching} onRefresh={() => void refresh()} />

      {devicesQuery.isPending && <VpnSkeleton />}

      {failed && (
        <VpnFailureCard
          kind={getVpnFailure(devicesQuery.error)}
          message={toApiError(devicesQuery.error).message}
          onRetry={() => void devicesQuery.refetch()}
        />
      )}

      {snapshot !== undefined && (
        <>
          {isSnapshotStale(snapshot.snapshotAt, now) && (
            <VpnBanner title="Datos desactualizados: puede que el temporizador del servidor esté parado">
              La última lectura de WireGuard es de {formatAgo(getSnapshotAgeMs(snapshot.snapshotAt, now))}. Los estados,
              handshakes y tráfico pueden no ser reales.
            </VpnBanner>
          )}

          {overdueRevocations.length > 0 && (
            <VpnBanner title="La revocación sigue pendiente. Revisa el temporizador del servidor">
              {overdueRevocations.map((device) => `«${device.name}»`).join(', ')}
              {overdueRevocations.length > 1 ? ' llevan' : ' lleva'} más de 3 minutos en «Revocando…».
            </VpnBanner>
          )}

          {devices.length === 0 ? (
            <EmptyState
              icon={Lock}
              title="Todavía no hay dispositivos"
              description="Cuando se cree un perfil en la Raspberry Pi aparecerá aquí en el siguiente refresco. Desde HomeDB no se pueden añadir dispositivos."
              action={
                <code className="rounded-lg bg-text-primary px-3.5 py-2.5 font-mono text-[13px] text-bg">$ pivpn add</code>
              }
            />
          ) : (
            <>
              <p className="text-[13px] text-text-secondary">{describeSummary(summarizeDevices(devices))}</p>

              <VpnToolbar
                filters={filters}
                onFiltersChange={setFilters}
                sort={sort}
                onSortChange={setSort}
                counts={counts}
                owners={ownersQuery.data ?? []}
              />

              {visible.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="Ningún dispositivo coincide"
                  description="Prueba con otro nombre o IP, o cambia los filtros."
                  action={
                    hasActiveFilters(filters) ? (
                      <Button type="button" variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>
                        Limpiar filtros
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(270px,1fr))]">
                  {visible.map((device) => (
                    <DeviceCard key={device.publicKey} device={device} nowMs={now} onOpen={() => openDetail(device)} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      <DeviceDetailModal
        device={selected}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        owners={ownersQuery.data ?? []}
        nowMs={now}
        onCloseAutoFocus={returnFocusToCard}
      />
    </div>
  )
}

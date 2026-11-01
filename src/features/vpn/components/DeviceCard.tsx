import { formatBytes } from '@/shared/lib/formatBytes'
import { cn } from '@/shared/lib/utils'

import { formatHandshake, getDeviceStatus } from '../presentation'
import type { VpnDevice } from '../types'
import { DeviceStatusBadge } from './DeviceStatusBadge'
import { OwnerAvatar } from './OwnerAvatar'

/** Atributo para devolver el foco a la tarjeta al cerrar el detalle (§11). */
export const DEVICE_CARD_ATTRIBUTE = 'data-device-key'

type DeviceCardProps = {
  device: VpnDevice
  nowMs: number
  onOpen: () => void
}

// CLAUDE.md §6.22 (variante B): una tarjeta por dispositivo con el estado en primer plano. Toda
// la tarjeta es un botón que abre el detalle: no lleva controles dentro, así que no hay nada
// anidado que se pueda activar por error.
export function DeviceCard({ device, nowMs, onOpen }: DeviceCardProps) {
  const status = getDeviceStatus(device)
  return (
    <button
      type="button"
      onClick={onOpen}
      {...{ [DEVICE_CARD_ATTRIBUTE]: device.publicKey }}
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-[14px] border border-border bg-card p-4 text-left shadow-float transition-colors sm:px-[18px]',
        // El hover oscurece el borde: bg-surface-alt no se distingue de bg-card en oscuro (§6.1)
        'hover:border-text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <div className="flex items-center gap-2.5">
        <DeviceStatusBadge status={status} />
        <span className="ml-auto text-xs text-text-secondary">{formatHandshake(device.lastHandshakeAt, nowMs)}</span>
      </div>

      <div className="min-w-0">
        <div className="truncate text-[17px] font-bold tracking-tight text-text-primary" title={device.name}>
          {device.name}
        </div>
        <div className="mt-[3px] font-mono text-xs text-text-secondary">{device.assignedIp}</div>
      </div>

      {/* Dos líneas fijas de alto: las tarjetas de una fila quedan alineadas con y sin notas */}
      <p
        className={cn(
          'line-clamp-2 min-h-[38px] text-[13px] leading-snug',
          device.notes === null ? 'text-text-muted-2' : 'text-text-secondary',
        )}
      >
        {device.notes ?? 'Sin notas'}
      </p>

      <div className="mt-auto flex min-w-0 items-center gap-2 border-t border-border-light pt-3 text-xs">
        <OwnerAvatar ownerName={device.ownerName} />
        <span className={cn('truncate', device.ownerName === null ? 'text-text-muted-2' : 'text-text-secondary')}>
          {device.ownerName ?? 'Sin asignar'}
        </span>
        <span className="ml-auto whitespace-nowrap font-mono text-text-secondary">
          ↓ {formatBytes(device.bytesReceived)} ↑ {formatBytes(device.bytesSent)}
        </span>
      </div>
    </button>
  )
}

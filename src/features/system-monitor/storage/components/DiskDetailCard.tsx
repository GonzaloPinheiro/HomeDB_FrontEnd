import { FloatCard } from '@/shared/components/FloatCard'
import { DetailField } from '@/shared/components/DetailGrid'
import { InlineMessage } from '@/shared/components/InlineMessage'
import { Progress } from '@/shared/components/ui/progress'
import { useNow } from '@/shared/hooks/useNow'
import { formatBytes } from '@/shared/lib/formatBytes'
import { formatAgo } from '@/shared/lib/formatDuration'
import { cn } from '@/shared/lib/utils'

import { METRIC_THRESHOLDS } from '../../thresholds'
import {
  USAGE_LABELS,
  getDiskMessage,
  getDiskStatus,
  getMinFreeMarkerPercent,
  getUsagePercent,
  type StorageDisk,
} from '../disks'
import { DiskStatusBadge } from './DiskStatusIcon'

const NO_DATA = 'Sin dato'

function bytesOrNoData(bytes: number | null): string {
  return bytes === null ? NO_DATA : formatBytes(bytes)
}

// CLAUDE.md §6.13: ficha de un disco concreto. Sustituye al gráfico de la vista Disco, porque el
// backend solo da el estado ACTUAL de estos discos (no hay histórico como el del disco del
// sistema, §5.4). Altura fija en escritorio (la del panel de Backups de al lado, 292px) con scroll
// interno: la fila del grid no crece con el número de ubicaciones.
export function DiskDetailCard({ disk }: { disk: StorageDisk }) {
  // Se actualiza cada segundo para que "hace X" no se quede congelado entre sondeos de 60 s
  const nowMs = useNow(true)
  const status = getDiskStatus(disk)
  const percent = getUsagePercent(disk)
  const markerPercent = getMinFreeMarkerPercent(disk)
  const message = getDiskMessage(disk)
  const checkedAtMs = Date.parse(disk.checkedAtUtc)
  const overThreshold = percent !== null && percent > METRIC_THRESHOLDS.disk

  return (
    <FloatCard className="flex flex-col gap-4 p-4 lg:h-[292px] lg:overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="text-sm font-semibold text-text-primary">Disco {disk.key}</h3>
          <DiskStatusBadge status={status} />
        </div>
        {!Number.isNaN(checkedAtMs) && (
          <span
            className="text-xs text-text-muted"
            // La disponibilidad es la de la última comprobación del servidor (cada ~60 s); la
            // capacidad se lee en el momento de la consulta.
            title="Última comprobación de disponibilidad del servidor. La capacidad se lee al consultar."
          >
            Comprobado {formatAgo(nowMs - checkedAtMs)}
          </span>
        )}
      </div>

      {message && <InlineMessage tone={message.tone}>{message.text}</InlineMessage>}

      {/* Sin porcentaje (disco caído o sin capacidad) no hay barra que enseñar: los campos de abajo
          ya dicen "Sin dato" y un guion enorme con una barra vacía solo ocuparía sitio. */}
      {percent !== null && disk.usedBytes !== null && disk.totalBytes !== null && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-1">
              <span className="text-[26px] font-bold tracking-tight text-text-primary">
                {percent.toFixed(1)}
              </span>
              <span className="text-sm text-text-muted">% usado</span>
            </div>
            <span className="text-xs text-text-muted-2">
              {formatBytes(disk.usedBytes)} de {formatBytes(disk.totalBytes)}
            </span>
          </div>
          {/* La marca de "libre mínimo" sobresale de la barra: va fuera del Progress, que recorta */}
          <div className="relative py-1">
            <Progress
              value={percent}
              className="h-[5px] bg-border-light"
              indicatorClassName={cn(
                status === 'belowMinFree' || overThreshold ? 'bg-critical-text' : 'bg-primary',
              )}
              aria-label={`Uso del disco ${disk.key}: ${percent.toFixed(1)}%`}
            />
            {markerPercent !== null && (
              <span
                className="absolute bottom-0 top-0 w-0.5 -translate-x-1/2 rounded-full bg-text-secondary"
                style={{ left: `${markerPercent}%` }}
                title={`Espacio libre mínimo: ${formatBytes(disk.minFreeBytes)}`}
                aria-hidden
              />
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <DetailField label="Usado">{bytesOrNoData(disk.usedBytes)}</DetailField>
        <DetailField label="Libre">{bytesOrNoData(disk.freeBytes)}</DetailField>
        <DetailField label="Total">{bytesOrNoData(disk.totalBytes)}</DetailField>
        <DetailField label="Libre mínimo">
          {disk.minFreeBytes > 0 ? formatBytes(disk.minFreeBytes) : 'Sin mínimo'}
        </DetailField>
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-text-muted">Ubicaciones</h4>
        <ul className="flex flex-col divide-y divide-border-light">
          {disk.locations.map((location) => (
            <li key={location.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-1.5 text-sm">
              <span className="flex items-center gap-2">
                <span className="font-mono text-text-primary">{location.key}</span>
                <span className="text-text-secondary">{USAGE_LABELS[location.usage]}</span>
                {location.isDefault && (
                  <span className="rounded-full border border-border-light bg-surface px-2 py-0.5 text-[11px] text-text-secondary">
                    Por defecto
                  </span>
                )}
              </span>
              <span className="text-xs text-text-muted">
                {location.maxUsedBytes !== null ? `Tope ${formatBytes(location.maxUsedBytes)}` : 'Sin tope'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </FloatCard>
  )
}

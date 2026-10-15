import { Activity, Cpu, HardDrive, MemoryStick, RefreshCw, Thermometer } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { toApiError } from '@/shared/api/client'
import { EmptyState } from '@/shared/components/EmptyState'
import { FloatCard } from '@/shared/components/FloatCard'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatBytes } from '@/shared/lib/formatBytes'
import { cn } from '@/shared/lib/utils'

import { useLastMetric, useMetricsHistory, type MetricRange } from '../api'
import { backupKeys, useBackupUnloadGuard } from '../backups/api'
import { METRIC_THRESHOLDS, METRIC_UNITS, getThresholdStatus, type MetricKey } from '../thresholds'
import type { SystemMetrics } from '../types'
import { FanStatusInline } from './FanStatus'
import { MetricCard } from './MetricCard'
import { MetricChart } from './MetricChart'
import { MetricSidePanel } from './MetricSidePanel'
import { RangeChips } from './RangeChips'

const METRIC_LABEL: Record<MetricKey, string> = {
  cpu: 'CPU',
  memory: 'Memoria',
  disk: 'Disco',
  temperature: 'Temperatura',
}

const METRIC_ICON = {
  cpu: Cpu,
  memory: MemoryStick,
  disk: HardDrive,
  temperature: Thermometer,
} as const

const METRIC_VALUE: Record<MetricKey, (m: SystemMetrics) => number | null> = {
  cpu: (m) => m.cpuUsagePercent,
  memory: (m) => m.memoryUsagePercent,
  disk: (m) => m.diskUsagePercent,
  temperature: (m) => m.temperatureCelsius,
}

const METRIC_DATA_KEY: Record<MetricKey, 'cpuUsagePercent' | 'memoryUsagePercent' | 'diskUsagePercent' | 'temperatureCelsius'> = {
  cpu: 'cpuUsagePercent',
  memory: 'memoryUsagePercent',
  disk: 'diskUsagePercent',
  temperature: 'temperatureCelsius',
}

function metricSubtitle(key: MetricKey, m: SystemMetrics): string | undefined {
  if (key === 'memory' && m.memoryUsedBytes !== null && m.memoryTotalBytes !== null) {
    return `${formatBytes(m.memoryUsedBytes)} de ${formatBytes(m.memoryTotalBytes)}`
  }
  if (key === 'disk' && m.diskUsedBytes !== null && m.diskTotalBytes !== null) {
    return `${formatBytes(m.diskUsedBytes)} de ${formatBytes(m.diskTotalBytes)}`
  }
  return undefined
}

export function SystemMonitorDashboard() {
  const [selected, setSelected] = useState<MetricKey>('cpu')
  const [range, setRange] = useState<MetricRange>('1h')

  const queryClient = useQueryClient()
  const last = useLastMetric()
  const history = useMetricsHistory(range)
  useBackupUnloadGuard()

  // CLAUDE.md §6.13/§7.9: refresco manual = refetch() de AMBAS queries activas,
  // más el historial de backups si el panel de Disco está montado (invalidar
  // solo refetchea las queries activas; las demás quedan marcadas como obsoletas)
  const refreshAll = () => {
    void last.refetch()
    void history.refetch()
    void queryClient.invalidateQueries({ queryKey: backupKeys.all })
  }

  if (last.isPending) {
    return <MonitorSkeleton />
  }

  // `data === undefined` y no `isError`: un refetch fallido (corte puntual en el
  // sondeo de 60s) deja status "error" con el último dato aún disponible, y no
  // debe sustituir todo el panel por el estado vacío.
  if (last.data === undefined) {
    return (
      <div className="px-4 py-6 sm:px-8 sm:py-[26px]">
        <EmptyState
          icon={Activity}
          title="Sin datos todavía"
          description={toApiError(last.error).message}
          action={
            <Button variant="outline" onClick={() => void last.refetch()}>
              Reintentar
            </Button>
          }
        />
      </div>
    )
  }

  const metric = last.data

  return (
    // §6.13/§6.18: mismo ritmo y cabecera que Inicio (padding, hueco de 22px, título grande)
    <div className="flex min-h-full flex-col gap-[22px] px-4 py-6 sm:px-8 sm:py-[26px]">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1.5 text-[13px] text-text-secondary">Estado del servidor</p>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-[30px]">Monitor</h1>
        </div>
        <Button
          variant="outline"
          onClick={refreshAll}
          disabled={last.isFetching || history.isFetching}
          className="gap-2"
        >
          <RefreshCw className={cn('h-4 w-4', (last.isFetching || history.isFetching) && 'animate-spin')} aria-hidden />
          Refrescar
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(Object.keys(METRIC_LABEL) as MetricKey[]).map((key) => {
          const value = METRIC_VALUE[key](metric)
          return (
            <MetricCard
              key={key}
              label={METRIC_LABEL[key]}
              icon={METRIC_ICON[key]}
              value={value}
              unit={METRIC_UNITS[key]}
              status={getThresholdStatus(key, value)}
              selected={selected === key}
              onSelect={() => setSelected(key)}
              subtitle={metricSubtitle(key, metric)}
              extra={key === 'temperature' ? <FanStatusInline metric={metric} /> : undefined}
            />
          )
        })}
      </div>

      {/* CLAUDE.md §10: flex-wrap por consistencia con el resto de cabeceras de pantalla — margen de seguridad a ~375px/zoom grande */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-text-primary">{METRIC_LABEL[selected]}</h2>
        <RangeChips value={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_260px]">
        <FloatCard className="p-4">
          {history.isPending ? (
            <Skeleton className="h-[260px] w-full" />
          ) : history.isError ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-text-muted">
              {toApiError(history.error).message}
            </div>
          ) : (
            <MetricChart
              data={history.data}
              dataKey={METRIC_DATA_KEY[selected]}
              unit={METRIC_UNITS[selected]}
              threshold={METRIC_THRESHOLDS[selected]}
              fixedDomain={selected !== 'temperature'}
            />
          )}
        </FloatCard>
        <MetricSidePanel selected={selected} metric={metric} />
      </div>
    </div>
  )
}

// CLAUDE.md §6.10: skeleton con la forma del contenido real (tarjetas + gráfico)
function MonitorSkeleton() {
  return (
    <div className="flex min-h-full flex-col gap-[22px] px-4 py-6 sm:px-8 sm:py-[26px]" aria-hidden>
      <div className="flex items-end justify-between">
        <div>
          <Skeleton className="mb-2 h-4 w-32" />
          <Skeleton className="h-8 w-28" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[142px] rounded-[14px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_260px]">
        <Skeleton className="h-[292px] rounded-[14px]" />
        <Skeleton className="h-[292px] rounded-[14px]" />
      </div>
    </div>
  )
}

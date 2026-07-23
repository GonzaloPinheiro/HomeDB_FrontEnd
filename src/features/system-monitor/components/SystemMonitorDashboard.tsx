import { Activity, Cpu, HardDrive, MemoryStick, RefreshCw, Thermometer } from 'lucide-react'
import { useState } from 'react'

import { toApiError } from '@/shared/api/client'
import { EmptyState } from '@/shared/components/EmptyState'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatBytes } from '@/shared/lib/formatBytes'
import { cn } from '@/shared/lib/utils'

import { useLastMetric, useMetricsHistory, type MetricRange } from '../api'
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

  const last = useLastMetric()
  const history = useMetricsHistory(range)

  // CLAUDE.md §6.13/§7.9: refresco manual = refetch() de AMBAS queries activas
  const refreshAll = () => {
    void last.refetch()
    void history.refetch()
  }

  if (last.isPending) {
    return <MonitorSkeleton />
  }

  if (last.isError) {
    return (
      <div className="p-4 md:p-6">
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
    <div className="flex min-h-full flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-text-primary">Monitor</h1>
        <Button
          variant="outline"
          onClick={refreshAll}
          disabled={last.isFetching || history.isFetching}
          className="gap-2"
        >
          <RefreshCw className={cn('h-4 w-4', (last.isFetching || history.isFetching) && 'animate-spin')} aria-hidden />
          Refrescar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
        <h2 className="text-sm font-medium text-text-secondary">{METRIC_LABEL[selected]}</h2>
        <RangeChips value={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
        <div className="rounded-xl border border-border bg-card p-4">
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
        </div>
        <MetricSidePanel selected={selected} metric={metric} />
      </div>
    </div>
  )
}

// CLAUDE.md §6.10: skeleton con la forma del contenido real (tarjetas + gráfico)
function MonitorSkeleton() {
  return (
    <div className="flex min-h-full flex-col gap-4 p-4 md:p-6" aria-hidden>
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
        <Skeleton className="h-[292px] rounded-xl" />
        <Skeleton className="h-[292px] rounded-xl" />
      </div>
    </div>
  )
}

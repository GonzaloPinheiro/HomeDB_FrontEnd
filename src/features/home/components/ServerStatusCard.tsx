import { Link } from 'react-router-dom'

import { useLastMetric } from '@/features/system-monitor/api'
import { getThresholdStatus } from '@/features/system-monitor/thresholds'
import { toApiError } from '@/shared/api/client'
import { ApiErrorCodes } from '@/shared/api/errors'
import { Progress } from '@/shared/components/ui/progress'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { usePermissions } from '@/shared/hooks/usePermissions'
import { formatBytes } from '@/shared/lib/formatBytes'
import { cn } from '@/shared/lib/utils'

import { FloatCard } from '@/shared/components/FloatCard'

type MetricRowProps = {
  label: string
  /** Texto del valor (ya formateado); `null` = el sensor no devolvió dato. */
  valueText: string | null
  /** 0-100 para la barra; `null` = sin barra llena. */
  percent: number | null
  critical: boolean
}

function MetricRow({ label, valueText, percent, critical }: MetricRowProps) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[13px]">
        <span className="text-text-secondary">{label}</span>
        <span className={cn('font-mono', critical ? 'text-critical-text' : 'text-text-primary')}>
          {valueText ?? '—'}
        </span>
      </div>
      <Progress
        value={percent ?? 0}
        className="h-[5px] bg-border-light"
        indicatorClassName={critical ? 'bg-critical-text' : 'bg-primary'}
        aria-label={label}
      />
    </div>
  )
}

function CardShell({
  children,
  showLink = true,
}: {
  children: React.ReactNode
  showLink?: boolean
}) {
  return (
    <FloatCard className="flex-none px-[22px] py-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-text-primary">Estado del servidor</h2>
        {/* El diseño mostraba aquí los días sin reiniciar: el backend no expone uptime (§5.4) */}
        {showLink ? (
          <Link to="/monitor" className="text-xs text-accent hover:underline">
            Ver monitor
          </Link>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </FloatCard>
  )
}

// Hook en un componente interno: useLastMetric no se puede llamar
// condicionalmente, y sin el módulo SystemMonitor el endpoint da 403 (§5.3).
function ServerStatusContent() {
  const metric = useLastMetric()

  if (metric.isPending) {
    return (
      <div className="flex flex-col gap-3.5">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  // Sin dato alguno (no `isError`): un refetch fallido conserva el último valor.
  if (metric.data === undefined) {
    // §5.4: 404 MetricNotFound = instalación nueva sin ninguna muestra todavía
    const noDataYet = toApiError(metric.error).errorCode === ApiErrorCodes.MetricNotFound
    return (
      <p className="text-sm text-text-secondary">
        {noDataYet
          ? 'Todavía no hay métricas del servidor.'
          : 'No se pudo cargar el estado del servidor.'}
      </p>
    )
  }

  const m = metric.data
  const memoryText =
    m.memoryUsedBytes !== null && m.memoryTotalBytes !== null
      ? `${formatBytes(m.memoryUsedBytes)} / ${formatBytes(m.memoryTotalBytes)}`
      : m.memoryUsagePercent !== null
        ? `${Math.round(m.memoryUsagePercent)} %`
        : null

  return (
    <div className="flex flex-col gap-[13px]">
      <MetricRow
        label="CPU"
        valueText={m.cpuUsagePercent !== null ? `${Math.round(m.cpuUsagePercent)} %` : null}
        percent={m.cpuUsagePercent}
        critical={getThresholdStatus('cpu', m.cpuUsagePercent) === 'critical'}
      />
      <MetricRow
        label="Memoria"
        valueText={memoryText}
        percent={m.memoryUsagePercent}
        critical={getThresholdStatus('memory', m.memoryUsagePercent) === 'critical'}
      />
      <MetricRow
        label="Temperatura"
        valueText={m.temperatureCelsius !== null ? `${Math.round(m.temperatureCelsius)} °C` : null}
        // La temperatura no es un %: la barra la escala sobre 100 °C (referencia visual, no un límite real)
        percent={m.temperatureCelsius !== null ? Math.min(100, m.temperatureCelsius) : null}
        critical={getThresholdStatus('temperature', m.temperatureCelsius) === 'critical'}
      />
    </div>
  )
}

// Datos reales de GET /system-metrics/last-metric (§5.4), con el mismo color por
// umbral que el Monitor (§6.13). Se refresca solo (refetchInterval de la query).
export function ServerStatusCard() {
  const { hasModule } = usePermissions()

  if (!hasModule('SystemMonitor')) {
    return (
      <CardShell showLink={false}>
        <p className="text-sm text-text-secondary">No tienes activado el módulo Monitor.</p>
      </CardShell>
    )
  }
  return (
    <CardShell>
      <ServerStatusContent />
    </CardShell>
  )
}

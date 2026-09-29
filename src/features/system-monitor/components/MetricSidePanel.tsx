import { Construction, ShieldAlert } from 'lucide-react'

import { usePermissions } from '@/shared/hooks/usePermissions'

import { BackupPanel } from '../backups/components/BackupPanel'
import type { MetricKey } from '../thresholds'
import type { SystemMetrics } from '../types'
import { FanDetailPanel } from './FanStatus'

type MetricSidePanelProps = {
  selected: MetricKey
  metric: SystemMetrics
}

// CLAUDE.md §6.13: cuadro lateral junto al gráfico — detalle completo del
// ventilador para Temperatura, sistema de backups para Disco; para CPU/Memoria
// queda reservado con "En desarrollo" (espacio preparado para datos futuros,
// no un hueco vacío sin explicación).
export function MetricSidePanel({ selected, metric }: MetricSidePanelProps) {
  const { isAdmin } = usePermissions()

  if (selected === 'temperature') {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <FanDetailPanel metric={metric} />
      </div>
    )
  }

  if (selected === 'disk') {
    // CLAUDE.md §5.3/§5.4: BackupController exige rol Admin además del módulo
    // SystemMonitor — un User con el módulo ve el Monitor pero no los backups.
    if (!isAdmin) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 text-center">
          <ShieldAlert className="h-5 w-5 text-text-faint" aria-hidden />
          <p className="text-sm font-medium text-text-secondary">Backups</p>
          <p className="text-xs text-text-muted">El estado de los backups solo está disponible para administradores.</p>
        </div>
      )
    }
    return <BackupPanel />
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 text-center">
      <Construction className="h-5 w-5 text-text-faint" aria-hidden />
      <p className="text-sm font-medium text-text-secondary">En desarrollo</p>
      <p className="text-xs text-text-muted">
        Espacio reservado para más datos de esta métrica (ej. modelo de CPU, tipo de memoria).
      </p>
    </div>
  )
}

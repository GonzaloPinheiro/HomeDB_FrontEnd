import { Construction } from 'lucide-react'

import type { MetricKey } from '../thresholds'
import type { SystemMetrics } from '../types'
import { FanDetailPanel } from './FanStatus'

type MetricSidePanelProps = {
  selected: MetricKey
  metric: SystemMetrics
}

// CLAUDE.md §6.13: cuadro lateral junto al gráfico — detalle completo del
// ventilador solo para Temperatura; para CPU/Memoria/Disco queda reservado
// con "En desarrollo" (espacio preparado para datos futuros, no un hueco
// vacío sin explicación).
export function MetricSidePanel({ selected, metric }: MetricSidePanelProps) {
  if (selected === 'temperature') {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <FanDetailPanel metric={metric} />
      </div>
    )
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

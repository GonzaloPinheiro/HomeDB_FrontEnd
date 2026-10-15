import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Progress } from '@/shared/components/ui/progress'
import { cn } from '@/shared/lib/utils'

import type { ThresholdStatus } from '../thresholds'

type MetricCardProps = {
  label: string
  icon: LucideIcon
  value: number | null
  unit: string
  status: ThresholdStatus
  selected: boolean
  onSelect: () => void
  subtitle?: string
  /** CLAUDE.md §6.13: ventilador integrado en la tarjeta de Temperatura, no aparte. */
  extra?: ReactNode
}

// CLAUDE.md §6.13: las 4 tarjetas actúan como selector — la activa se resalta
// (borde/fondo en acento); color por umbral (§6.7) solo cuando el valor supera
// el umbral crítico, acento único mientras es normal.
export function MetricCard({
  label,
  icon: Icon,
  value,
  unit,
  status,
  selected,
  onSelect,
  subtitle,
  extra,
}: MetricCardProps) {
  const isCritical = status === 'critical'
  const barValue = value === null ? 0 : Math.min(100, Math.max(0, value))

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        // §6.18: misma tarjeta flotante que Inicio (radio 14px + shadow-float); el hover
        // de las no seleccionadas oscurece el borde — bg-surface-alt no se distingue de
        // bg-card en oscuro (§6.1)
        'flex flex-col gap-3 rounded-[14px] border p-5 text-left shadow-float transition-colors',
        selected ? 'border-accent bg-accent-tint-bg' : 'border-border bg-card hover:border-text-faint',
      )}
    >
      <span className="flex items-center gap-2 text-xs text-text-secondary">
        <Icon className="h-4 w-4" aria-hidden />
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span className={cn('text-[26px] font-bold tracking-tight', isCritical ? 'text-critical-text' : 'text-text-primary')}>
          {value !== null ? value.toFixed(1) : '—'}
        </span>
        {value !== null && <span className="text-sm text-text-muted">{unit}</span>}
      </div>
      {subtitle && <span className="text-xs text-text-muted-2">{subtitle}</span>}
      <Progress
        value={barValue}
        className="h-[5px] bg-border-light"
        indicatorClassName={isCritical ? 'bg-critical-text' : 'bg-primary'}
        aria-label={`${label}: ${value !== null ? `${value.toFixed(1)}${unit}` : 'sin datos'}`}
      />
      {extra}
    </button>
  )
}

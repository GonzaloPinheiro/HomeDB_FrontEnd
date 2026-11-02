import { CircleAlert, CircleCheck, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'

import { FloatCard } from '@/shared/components/FloatCard'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatInteger } from '@/shared/lib/formatNumber'
import { cn } from '@/shared/lib/utils'

import { useLogsHealth } from '../api'
import { healthTone, type HealthTone } from '../presentation'

// Insignia de la esquina: el color lleva significado (§6.7) y va SIEMPRE con icono y texto, nunca solo.
// Los tokens semánticos solo contrastan sobre su propio fondo (§6.21), por eso cada uno es una pastilla.
const TONE_CHIP: Record<HealthTone, { icon: LucideIcon; className: string }> = {
  ok: { icon: CircleCheck, className: 'bg-positive-bg text-positive-text' },
  warning: { icon: TriangleAlert, className: 'bg-warning-bg text-warning-text' },
  critical: { icon: OctagonAlert, className: 'bg-critical-bg text-critical-text' },
}
const UNAVAILABLE_CHIP = { icon: CircleAlert, className: 'bg-surface text-text-muted' }

type HealthCardProps = {
  label: string
  /** `undefined` = todavía sin dato (cargando o fallido). */
  value: number | undefined
  isPending: boolean
  severity: 'error' | 'warning'
  captionOk: string
  captionBad: string
}

function HealthCard({ label, value, isPending, severity, captionOk, captionBad }: HealthCardProps) {
  if (isPending) {
    return (
      <FloatCard className="p-5" aria-hidden>
        <div className="text-xs text-text-secondary">{label}</div>
        <Skeleton className="mt-2.5 h-8 w-16" />
        <Skeleton className="mt-2 h-3 w-36" />
      </FloatCard>
    )
  }

  const tone = value === undefined ? null : healthTone(severity, value)
  const chip = tone === null ? UNAVAILABLE_CHIP : TONE_CHIP[tone]
  const Icon = chip.icon

  return (
    <FloatCard className="p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-text-secondary">{label}</span>
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', chip.className)}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <div
        className={cn(
          'mt-1.5 text-[26px] font-bold tabular-nums tracking-tight',
          value === undefined ? 'text-text-faint' : 'text-text-primary',
        )}
      >
        {value === undefined ? '—' : formatInteger(value)}
      </div>
      <div className="mt-1 text-xs text-text-secondary">
        {value === undefined ? 'No se pudo cargar' : tone === 'ok' ? captionOk : captionBad}
      </div>
    </FloatCard>
  )
}

// CLAUDE.md §6.23: las tres cifras de GET /admin/logs/health. Cuentan niveles concretos —`Error` y
// `Warning`—; las excepciones `Critical` no entran aquí y se ven en su tarjeta (§5.4), de ahí los textos.
export function LogsHealthCards() {
  const health = useLogsHealth()
  // `data === undefined` y no `isError` (§7.1): un refetch fallido deja el último dato visible
  const data = health.data

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <HealthCard
        label="Errores · última hora"
        value={data?.errorsLastHour}
        isPending={health.isPending}
        severity="error"
        captionOk="Sin errores"
        captionBad="Nivel Error · sin contar críticos"
      />
      <HealthCard
        label="Errores · 24 h"
        value={data?.errorsLast24h}
        isPending={health.isPending}
        severity="error"
        captionOk="Sin errores"
        captionBad="Nivel Error · sin contar críticos"
      />
      <HealthCard
        label="Avisos · 24 h"
        value={data?.warningsLast24h}
        isPending={health.isPending}
        severity="warning"
        captionOk="Sin avisos"
        captionBad="Nivel Warning · fallos esperados"
      />
    </div>
  )
}

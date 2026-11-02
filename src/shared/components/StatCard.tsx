import { Activity, CircleAlert, CircleCheck, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'

import { FloatCard } from '@/shared/components/FloatCard'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatInteger } from '@/shared/lib/formatNumber'
import { cn } from '@/shared/lib/utils'

export type StatTone = 'ok' | 'warning' | 'critical' | 'neutral'

// Insignia de la esquina: el color lleva significado (§6.7) y va SIEMPRE con icono y texto, nunca solo.
// Los tokens semánticos solo contrastan sobre su propio fondo (§6.21), por eso cada uno es una pastilla.
const TONE_CHIP: Record<StatTone, { icon: LucideIcon; className: string }> = {
  ok: { icon: CircleCheck, className: 'bg-positive-bg text-positive-text' },
  warning: { icon: TriangleAlert, className: 'bg-warning-bg text-warning-text' },
  critical: { icon: OctagonAlert, className: 'bg-critical-bg text-critical-text' },
  neutral: { icon: Activity, className: 'bg-surface text-text-muted' },
}
const UNAVAILABLE_CHIP = { icon: CircleAlert, className: 'bg-surface text-text-muted' }

type StatCardProps = {
  label: string
  /** `undefined` = todavía sin dato (cargando o fallido). */
  value: number | undefined
  isPending: boolean
  tone: StatTone
  caption: string
  /** Solo para `tone="neutral"`: el resto de tonos llevan su icono (ok, aviso, crítico). */
  icon?: LucideIcon
}

// Tarjeta de cifra con insignia de estado, compartida por Registros (§6.23) y Auditoría (§6.24). Misma
// tipografía que las StatCards de Inicio (§6.18): etiqueta xs, cifra de 26px en negrita.
export function StatCard({ label, value, isPending, tone, caption, icon }: StatCardProps) {
  if (isPending) {
    return (
      <FloatCard className="p-5" aria-hidden>
        <div className="text-xs text-text-secondary">{label}</div>
        <Skeleton className="mt-2.5 h-8 w-16" />
        <Skeleton className="mt-2 h-3 w-36" />
      </FloatCard>
    )
  }

  const unavailable = value === undefined
  const chip = unavailable ? UNAVAILABLE_CHIP : TONE_CHIP[tone]
  const Icon = tone === 'neutral' && !unavailable && icon !== undefined ? icon : chip.icon

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
          unavailable ? 'text-text-faint' : 'text-text-primary',
        )}
      >
        {unavailable ? '—' : formatInteger(value)}
      </div>
      <div className="mt-1 text-xs text-text-secondary">{unavailable ? 'No se pudo cargar' : caption}</div>
    </FloatCard>
  )
}

import { ArrowDown, ArrowUp, Check, CircleDashed, Ellipsis, Pause, TriangleAlert, type LucideIcon } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

import { STATUS_LABELS } from '../labels'
import type { TorrentStatus } from '../types'

// CLAUDE.md §6.19: insignia de estado. Color con propósito (§6.7): acento mientras
// descarga, verde = a salvo (sembrando/completado), rojo = fallo, neutro = en
// espera. El icono acompaña siempre al color: el estado no depende solo de él.
const STATUS_STYLE: Record<TorrentStatus, { icon: LucideIcon; className: string }> = {
  downloading: { icon: ArrowDown, className: 'bg-accent-tint-bg text-accent-tint-text' },
  // Neutro: `bg-surface` + borde y no `bg-surface-alt`, que en oscuro vale lo mismo que la tarjeta (§6.1) y desaparece
  queued: { icon: Ellipsis, className: 'border border-border-light bg-surface text-text-secondary' },
  paused: { icon: Pause, className: 'border border-border-light bg-surface text-text-secondary' },
  seeding: { icon: ArrowUp, className: 'bg-positive-bg text-positive-text' },
  completed: { icon: Check, className: 'bg-positive-bg text-positive-text' },
  error: { icon: TriangleAlert, className: 'bg-critical-bg text-critical-text' },
  contentDeleted: { icon: CircleDashed, className: 'border border-dashed border-text-faint text-text-muted' },
}

export function TorrentStatusBadge({ status, className }: { status: TorrentStatus; className?: string }) {
  const { icon: Icon, className: style } = STATUS_STYLE[status]
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold',
        style,
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  )
}

import { AlertTriangle, Check, Minus, X } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

import { DISK_STATUS_META, type DiskStatus, type DiskTone } from '../disks'

// §6.1/§6.7: el estado se da siempre con icono, nunca solo con color. Cada icono va en su propio
// círculo con fondo semántico: `critical-text`/`warning-text`/`positive-text` solo contrastan sobre
// su fondo (§6.21), y este indicador se pinta también sobre el botón activo, que es de acento.
const TONE_CLASSES: Record<DiskTone, string> = {
  positive: 'bg-positive-bg text-positive-text',
  warning: 'bg-warning-bg text-warning-text',
  critical: 'bg-critical-bg text-critical-text',
  neutral: 'bg-surface text-text-secondary',
}

const STATUS_ICON: Record<DiskStatus, typeof Check> = {
  ok: Check,
  highUsage: AlertTriangle,
  belowMinFree: X,
  readOnly: AlertTriangle,
  unavailable: X,
  noCapacity: Minus,
}

/** Indicador redondo de estado de un disco. Decorativo: el nombre accesible lo da quien lo usa. */
export function DiskStatusIcon({ status, className }: { status: DiskStatus; className?: string }) {
  const Icon = STATUS_ICON[status]
  return (
    <span
      className={cn(
        'inline-grid h-4 w-4 shrink-0 place-items-center rounded-full',
        TONE_CLASSES[DISK_STATUS_META[status].tone],
        className,
      )}
      aria-hidden
    >
      <Icon className="h-2.5 w-2.5" strokeWidth={3} />
    </span>
  )
}

/** Insignia con icono y etiqueta ("Solo lectura"), sobre el mismo fondo semántico. */
export function DiskStatusBadge({ status }: { status: DiskStatus }) {
  const meta = DISK_STATUS_META[status]
  const Icon = STATUS_ICON[status]
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[meta.tone],
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={3} aria-hidden />
      {meta.label}
    </span>
  )
}

import { cn } from '@/shared/lib/utils'

import { STATUS_LABELS, type DeviceStatus } from '../presentation'

// Color con propósito (§6.7): verde = conectado, ámbar = revocación en curso, neutro = sin
// conexión. Siempre en una píldora con su fondo: el texto `positive-text`/`warning-text` solo
// contrasta sobre su propio fondo (es igual en claro y oscuro, §6.1), no sobre la tarjeta. Y el
// estado nunca depende solo del color: lleva punto, anillo o spinner y la etiqueta.
// Los neutros usan `bg-surface` + borde y no `bg-surface-alt` (que en oscuro desaparece, §6.1).
const STATUS_STYLE: Record<DeviceStatus, string> = {
  revoking: 'bg-warning-bg text-warning-text',
  active: 'bg-positive-bg text-positive-text',
  inactive: 'border border-border-light bg-surface text-text-secondary',
  never: 'border border-dashed border-text-faint text-text-muted',
}

function Indicator({ status }: { status: DeviceStatus }) {
  if (status === 'revoking') {
    return (
      <span
        className="h-2.5 w-2.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
        aria-hidden
      />
    )
  }
  // "Nunca conectado": anillo vacío, para distinguirlo de un inactivo que sí se conectó alguna vez
  return (
    <span
      className={cn('h-1.5 w-1.5 shrink-0 rounded-full', status === 'never' ? 'border border-current' : 'bg-current')}
      aria-hidden
    />
  )
}

export function DeviceStatusBadge({ status, className }: { status: DeviceStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
        STATUS_STYLE[status],
        className,
      )}
    >
      <Indicator status={status} />
      {STATUS_LABELS[status]}
    </span>
  )
}

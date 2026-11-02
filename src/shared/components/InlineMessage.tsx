import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'

type InlineMessageProps = {
  /** `critical` = error de validación; `warning` = aviso (p. ej. "Cambios sin guardar"). */
  tone: 'critical' | 'warning'
  children: ReactNode
  className?: string
}

// Mensaje corto junto a un campo o un botón. Va SIEMPRE sobre su propio fondo semántico: los
// tokens `critical-text` y `warning-text` son iguales en claro y oscuro (§6.1) y solo contrastan
// sobre `critical-bg`/`warning-bg`; sueltos sobre la tarjeta oscura quedan en ~1,8:1 (§6.19).
export function InlineMessage({ tone, children, className }: InlineMessageProps) {
  return (
    <p
      role={tone === 'critical' ? 'alert' : undefined}
      className={cn(
        'w-fit max-w-full rounded-md px-2.5 py-1.5 text-xs leading-snug',
        tone === 'critical' ? 'bg-critical-bg text-critical-text' : 'bg-warning-bg text-warning-text',
        className,
      )}
    >
      {children}
    </p>
  )
}

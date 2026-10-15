import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/utils'

// Tarjeta "flotante" del diseño de Inicio (§6.18), compartida con el Monitor
// (§6.13): radio grande y sombra suave de dos capas (`shadow-float`,
// tailwind.config.ts) sobre el lienzo hundido.
export function FloatCard({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-[14px] border border-border bg-card shadow-float', className)}
      {...props}
    />
  )
}

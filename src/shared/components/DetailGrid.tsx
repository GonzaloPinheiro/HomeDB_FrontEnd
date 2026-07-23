import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'

// CLAUDE.md §6.8: despliegue inline por fila (Logs, Auditoría) — grid de
// campo/valor reutilizado por ambas features para no duplicar el mismo layout.
export function DetailGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}

export function DetailField({
  label,
  children,
  className,
  full,
}: {
  label: string
  children: ReactNode
  className?: string
  full?: boolean
}) {
  return (
    <div className={cn('flex flex-col gap-0.5', full && 'col-span-full', className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</span>
      <div className="text-sm text-text-primary">{children}</div>
    </div>
  )
}

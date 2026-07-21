import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
  /**
   * CLAUDE.md §6.9: botón de acción SOLO si hay algo que el usuario pueda hacer.
   * Omitirlo para estados puramente informativos (ej. "sin módulos activados").
   */
  action?: ReactNode
  className?: string
}

// CLAUDE.md §6.9: único componente compartido de estado vacío de toda la app
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-16 text-center', className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
        <Icon className="h-6 w-6 text-text-muted" aria-hidden />
      </div>
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      <p className="max-w-sm text-sm text-text-secondary">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

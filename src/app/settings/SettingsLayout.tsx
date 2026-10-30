import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'

// CLAUDE.md §6.20: piezas de maquetación comunes a todas las secciones del modal de
// ajustes, para que ninguna reinvente su cabecera, sus tarjetas ni sus filas.

type SettingsPanelProps = {
  title: string
  description?: string
  /** Etiqueta junto al título ("En desarrollo") para secciones que aún no funcionan. */
  tag?: ReactNode
  children: ReactNode
}

/** Cabecera + contenido de una sección. `pr-8` deja sitio al botón de cerrar del diálogo. */
export function SettingsPanel({ title, description, tag, children }: SettingsPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      <header className="pr-8">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          {tag}
        </div>
        {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
      </header>
      {children}
    </div>
  )
}

type SettingsCardProps = {
  title?: string
  description?: string
  children: ReactNode
  className?: string
}

export function SettingsCard({ title, description, children, className }: SettingsCardProps) {
  return (
    <section className={cn('rounded-xl border border-border bg-surface p-5', className)}>
      {title ? <h3 className="text-sm font-semibold text-text-primary">{title}</h3> : null}
      {description ? <p className="mt-1 text-xs text-text-secondary">{description}</p> : null}
      <div className={cn(title || description ? 'mt-4' : '')}>{children}</div>
    </section>
  )
}

type SettingsRowProps = {
  title: string
  description?: string
  /** Control a la derecha: botón, interruptor… */
  children?: ReactNode
  tag?: ReactNode
}

/** Fila "título + descripción a la izquierda, control a la derecha"; las filas contiguas se separan con una línea. */
export function SettingsRow({ title, description, children, tag }: SettingsRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border-light py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-text-primary">{title}</p>
          {tag}
        </div>
        {description ? <p className="mt-0.5 text-xs text-text-secondary">{description}</p> : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  )
}

/** Etiqueta discreta para lo que está en la interfaz pero aún no funciona. */
export function ComingSoonTag({ label = 'Próximamente' }: { label?: string }) {
  return (
    <span className="rounded-md bg-surface-alt px-1.5 py-0.5 text-[11px] font-medium text-text-muted">
      {label}
    </span>
  )
}

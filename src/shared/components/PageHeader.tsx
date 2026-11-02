import type { ReactNode } from 'react'

type PageHeaderProps = {
  /** Línea pequeña sobre el título ("Diagnóstico del servidor"). */
  eyebrow: string
  title: string
  /** A la derecha: botones de la pantalla (p. ej. Refrescar). */
  actions?: ReactNode
}

// Cabecera con el ritmo de Inicio, Monitor y AdGuard (§6.18, §6.13, §6.21): línea secundaria + título
// grande. Compartida por Registros y Auditoría (§6.23, §6.24).
export function PageHeader({ eyebrow, title, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="mb-1.5 text-[13px] text-text-secondary">{eyebrow}</p>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-[30px]">{title}</h1>
      </div>
      {actions}
    </header>
  )
}

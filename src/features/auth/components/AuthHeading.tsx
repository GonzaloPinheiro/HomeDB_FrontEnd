import { Database } from 'lucide-react'

type AuthHeadingProps = {
  /** Etiqueta en mayúsculas sobre el título ("ACCESO PRIVADO"). */
  badge: string
  title: string
  description: string
}

// CLAUDE.md §6.17: cabecera común de las vistas del lado derecho del login (logo
// —solo sin el panel izquierdo—, etiqueta, título y descripción).
export function AuthHeading({ badge, title, description }: AuthHeadingProps) {
  return (
    <div className="flex flex-col gap-3.5">
      {/* Sin el panel izquierdo (por debajo de xl) el logo se muestra aquí */}
      <div className="mb-2 flex items-center gap-2.5 xl:hidden">
        <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-accent text-text-on-accent">
          <Database className="h-4 w-4" aria-hidden />
        </div>
        <span className="text-lg font-bold tracking-tight text-text-primary">HomeDB</span>
      </div>

      <span className="self-start rounded-[5px] border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-accent-tint-bg px-[9px] py-[5px] font-mono text-[11px] tracking-[1.4px] text-accent-tint-text">
        {badge}
      </span>
      <div>
        <h2 className="text-[28px] font-bold tracking-[-0.6px] text-text-primary">{title}</h2>
        <p className="mt-2 text-sm text-text-secondary">{description}</p>
      </div>
    </div>
  )
}

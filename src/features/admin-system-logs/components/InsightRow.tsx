import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'

// Lista y fila de las tarjetas de análisis de Registros (§6.23). Mismo diseño que los "Top 10" de
// AdGuard (§6.21: posición, nombre, cifra y barra relativa al primero), pero cada fila es un botón:
// llevar a la tabla los registros de esa operación es la razón de ser de estas tarjetas.

export function InsightList({ children }: { children: ReactNode }) {
  // -mx-2 + px-2 en cada fila: el sombreado del hover sobresale del texto sin descuadrar la tarjeta
  return <ul className="-mx-2 flex flex-col">{children}</ul>
}

type InsightRowProps = {
  /** Posición, empezando en 1. */
  rank: number
  name: string
  /** Cifra ya formateada ("4", "2,3 s"). */
  value: string
  /** Anchura de la barra, 0-100, relativa a la fila mayor de la lista. */
  percent: number
  barClassName: string
  /** Texto pequeño a la derecha de la barra (p. ej. cuándo ocurrió). */
  detail?: string
  /** Nombre accesible completo: el contenido visual solo trae cifras sueltas. */
  ariaLabel: string
  onSelect: () => void
}

export function InsightRow({ rank, name, value, percent, barClassName, detail, ariaLabel, onSelect }: InsightRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-label={ariaLabel}
        title={name}
        className={cn(
          'grid w-full grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-[5px] rounded-lg px-2 py-1.5 text-left transition-colors',
          'hover:bg-row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <span className="font-mono text-[11px] text-text-muted-2">{rank}</span>
        <span className="truncate font-mono text-xs text-text-primary">{name}</span>
        <span className="font-mono text-xs text-text-secondary">{value}</span>
        {/* min-h-4: la línea de la barra mide lo mismo con y sin texto de detalle, así las dos tarjetas comparten ritmo */}
        <div className="col-span-2 col-start-2 flex min-h-4 items-center gap-2.5">
          <div className="h-1 flex-1 rounded-sm bg-border-light" aria-hidden>
            <div className={cn('h-full rounded-sm', barClassName)} style={{ width: `${percent}%` }} />
          </div>
          {detail !== undefined && <span className="whitespace-nowrap text-[11px] text-text-muted-2">{detail}</span>}
        </div>
      </button>
    </li>
  )
}

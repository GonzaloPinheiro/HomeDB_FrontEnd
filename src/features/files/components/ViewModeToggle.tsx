import { LayoutGrid, List } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

import type { ViewMode } from '../viewMode'

type ViewModeToggleProps = {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

const OPTIONS: ReadonlyArray<{ mode: ViewMode; label: string; Icon: typeof List }> = [
  { mode: 'list', label: 'Vista de lista', Icon: List },
  { mode: 'grid', label: 'Vista de miniaturas', Icon: LayoutGrid },
]

// CLAUDE.md §6.3b: alterna entre lista (iconos) y miniaturas. Dos botones nativos
// con aria-pressed (Tab para llegar, Enter/Espacio para elegir) agrupados bajo una
// etiqueta; se queda en la cabecera del panel, a la izquierda del buscador.
export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div role="group" aria-label="Modo de visualización" className="flex shrink-0 rounded-lg border border-border bg-surface p-0.5">
      {OPTIONS.map(({ mode, label, Icon }) => {
        const active = value === mode
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            aria-label={label}
            title={label}
            onClick={() => onChange(mode)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              active ? 'bg-accent-tint-bg text-accent-tint-text' : 'text-text-muted hover:text-text-primary',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

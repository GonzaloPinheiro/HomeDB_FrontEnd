import { Check, Minus } from 'lucide-react'
import type { MouseEvent } from 'react'

import { cn } from '@/shared/lib/utils'

type SelectCheckboxProps = {
  checked: boolean | 'mixed'
  onToggle: (event: MouseEvent) => void
  label: string
  className?: string
}

// CLAUDE.md §6.3: casilla de selección del explorador. Botón nativo con
// role="checkbox" (foco con Tab, Espacio/Enter alternan) y estado "mixed" para
// la casilla de cabecera con selección parcial. Detiene la propagación del clic:
// la fila de una carpeta entra al hacer clic, y marcar su casilla no debe entrar.
export function SelectCheckbox({ checked, onToggle, label, className }: SelectCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation()
        onToggle(event)
      }}
      className={cn(
        'relative flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
        // CLAUDE.md §10: área táctil real ~32px sin agrandar el icono visual
        "after:absolute after:-inset-1.5 after:content-['']",
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        checked
          ? 'border-accent bg-accent text-text-on-accent'
          : 'border-text-faint bg-card hover:border-text-muted',
        className,
      )}
    >
      {checked === 'mixed' ? (
        <Minus className="h-3.5 w-3.5" aria-hidden />
      ) : checked ? (
        <Check className="h-3.5 w-3.5" aria-hidden />
      ) : null}
    </button>
  )
}

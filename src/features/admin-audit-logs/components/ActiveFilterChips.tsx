import { X } from 'lucide-react'

import type { AuditLogsFilters } from '../api'
import type { FilterChip } from '../presentation'

type ActiveFilterChipsProps = {
  chips: FilterChip[]
  onRemove: (clear: Partial<AuditLogsFilters>) => void
}

// CLAUDE.md §6.24: un chip por filtro activo que no sea el texto de la barra. Tras un drill-down desde una
// fila el filtro queda a la vista y se quita con un clic, en vez de esconderse tras el contador del botón
// "Filtros". Tono de acento (estado activo, §6.1).
export function ActiveFilterChips({ chips, onRemove }: ActiveFilterChipsProps) {
  if (chips.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-2" aria-label="Filtros activos">
      {chips.map((chip) => (
        <li key={chip.key}>
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-tint-bg py-0.5 pl-3 pr-1 text-xs font-medium text-accent-tint-text">
            {chip.label}
            <button
              type="button"
              onClick={() => onRemove(chip.clear)}
              aria-label={`Quitar filtro: ${chip.label}`}
              // Área táctil mayor que el icono (§10)
              className="relative flex h-5 w-5 items-center justify-center rounded-full hover:bg-accent-tint-text/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-1.5 after:content-['']"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        </li>
      ))}
    </ul>
  )
}

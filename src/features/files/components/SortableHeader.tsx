import { ArrowDown, ArrowUp } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

import type { SortDirection, SortKey } from '../sort'

type SortableHeaderProps = {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  direction: SortDirection
  onSort: (key: SortKey) => void
  className?: string
}

// CLAUDE.md §6.3/§6.6: cabecera ordenable — clic para ordenar, clic de nuevo
// para invertir, flecha solo en la columna activa. Las tablas de Admin usarán
// este mismo patrón; cuando llegue ese segundo consumidor real, subirá a
// shared/ con los requisitos claros (no antes, para no sobre-diseñar).
export function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = sortKey === activeKey
  const Arrow = direction === 'asc' ? ArrowUp : ArrowDown

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
      className={cn(
        'flex items-center gap-1 text-xs font-medium uppercase tracking-wide',
        isActive ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary',
        className,
      )}
    >
      {label}
      {isActive && <Arrow className="h-3 w-3" aria-hidden />}
    </button>
  )
}

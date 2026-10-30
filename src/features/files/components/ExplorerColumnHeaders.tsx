import { cn } from '@/shared/lib/utils'

import type { SortDirection, SortKey } from '../sort'
import type { ViewMode } from '../viewMode'
import { HEADER_ROW_CLASSES } from './explorerLayout'
import { SelectCheckbox } from '@/shared/components/SelectCheckbox'
import { SortableHeader } from './SortableHeader'

type ExplorerColumnHeadersProps = {
  viewMode: ViewMode
  /** Cuántos elementos hay visibles: con 0 la casilla de cabecera se desactiva. */
  visibleCount: number
  sortKey: SortKey
  sortDirection: SortDirection
  onSort: (key: SortKey) => void
  onToggleAll: () => void
}

// CLAUDE.md §6.3/§6.3b: fila de cabecera cuando NO hay selección (con selección la
// sustituye SelectionHeader, misma fila y altura). En lista son las cabeceras de
// columna alineadas con las columnas de FileRow; en miniaturas no hay columnas, así
// que los mismos tres criterios se ofrecen como una barra "Ordenar por" — mismo
// estado, mismo clic-para-ordenar/invertir, mismo aria-sort.
export function ExplorerColumnHeaders({
  viewMode,
  visibleCount,
  sortKey,
  sortDirection,
  onSort,
  onToggleAll,
}: ExplorerColumnHeadersProps) {
  const checkbox = (
    // Casilla de cabecera: seleccionar todo lo visible
    <SelectCheckbox
      checked={false}
      onToggle={onToggleAll}
      label="Seleccionar todo"
      className={cn(visibleCount === 0 && 'pointer-events-none opacity-40')}
    />
  )

  if (viewMode === 'grid') {
    return (
      <div className={HEADER_ROW_CLASSES}>
        {checkbox}
        <span className="hidden text-xs font-medium uppercase tracking-wide text-text-muted-2 sm:inline">Ordenar por</span>
        <SortableHeader label="Nombre" sortKey="name" activeKey={sortKey} direction={sortDirection} onSort={onSort} className="py-1.5" />
        <SortableHeader label="Tamaño" sortKey="size" activeKey={sortKey} direction={sortDirection} onSort={onSort} className="py-1.5" />
        <SortableHeader label="Fecha" sortKey="date" activeKey={sortKey} direction={sortDirection} onSort={onSort} className="py-1.5" />
      </div>
    )
  }

  return (
    <div className={HEADER_ROW_CLASSES}>
      {checkbox}
      <span className="w-5 shrink-0" aria-hidden />
      <SortableHeader
        label="Nombre"
        sortKey="name"
        activeKey={sortKey}
        direction={sortDirection}
        onSort={onSort}
        className="min-w-0 flex-1"
      />
      <SortableHeader
        label="Tamaño"
        sortKey="size"
        activeKey={sortKey}
        direction={sortDirection}
        onSort={onSort}
        className="hidden w-20 shrink-0 justify-end sm:flex"
      />
      <SortableHeader
        label="Fecha"
        sortKey="date"
        activeKey={sortKey}
        direction={sortDirection}
        onSort={onSort}
        className="hidden w-24 shrink-0 justify-end md:flex"
      />
      <span className="w-8 shrink-0" aria-hidden />
    </div>
  )
}

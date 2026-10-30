import { FolderInput, Trash2, X } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'

import { HEADER_ROW_CLASSES } from './explorerLayout'
import { SelectCheckbox } from '@/shared/components/SelectCheckbox'

type SelectionHeaderProps = {
  count: number
  allSelected: boolean
  /** Hay al menos un archivo seleccionado: las carpetas no se mueven (§6.3). */
  canMove: boolean
  onToggleAll: () => void
  onMove: () => void
  onDelete: () => void
  onClear: () => void
}

// CLAUDE.md §6.3: con selección activa esta barra sustituye a las cabeceras de
// columna (misma fila, misma altura — la lista no salta): cuenta, Mover,
// Eliminar y salir de la selección. No hay "Renombrar"/"Descargar" en lote: son
// acciones de un solo elemento (F2 solo con uno seleccionado).
export function SelectionHeader({ count, allSelected, canMove, onToggleAll, onMove, onDelete, onClear }: SelectionHeaderProps) {
  return (
    <div className={HEADER_ROW_CLASSES}>
      <SelectCheckbox
        checked={allSelected ? true : 'mixed'}
        onToggle={onToggleAll}
        label={allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary" role="status">
        {count} {count === 1 ? 'seleccionado' : 'seleccionados'}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {canMove && (
          <Button variant="ghost" size="sm" onClick={onMove}>
            <FolderInput />
            <span className="hidden sm:inline">Mover</span>
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-critical-text hover:text-critical-text">
          <Trash2 />
          <span className="hidden sm:inline">Eliminar</span>
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClear} aria-label="Cancelar selección">
          <X />
        </Button>
      </div>
    </div>
  )
}

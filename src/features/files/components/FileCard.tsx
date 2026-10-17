import { formatBytes } from '@/shared/lib/formatBytes'
import { cn } from '@/shared/lib/utils'

import { useExplorerItemInteraction } from '../useExplorerItemInteraction'
import { FileThumbnail } from './FileThumbnail'
import { ItemActionsMenu } from './ItemActionsMenu'
import type { ExplorerItemViewProps } from './itemViewProps'
import { SelectCheckbox } from './SelectCheckbox'

// CLAUDE.md §6.3b: tarjeta de la vista de miniaturas — misma interacción que
// FileRow (selección, arrastre, entrar en carpetas, menú de acciones: todo en
// useExplorerItemInteraction / ItemActionsMenu), solo cambia la presentación:
// zona cuadrada con la miniatura (o el icono grande) y el nombre debajo. La
// casilla y el menú flotan sobre la esquina de la imagen y solo se ven al pasar
// el ratón, con el foco, con la selección activa o en táctil, como en la lista.
export function FileCard({
  item,
  onEnterFolder,
  onDownload,
  onRename,
  onMove,
  onDelete,
  selected,
  selectionActive,
  onSelect,
}: ExplorerItemViewProps) {
  const isFolder = item.kind === 'folder'
  const { rowProps, isDragging, isOver } = useExplorerItemInteraction({ item, onEnterFolder, onSelect })

  return (
    <div
      {...rowProps}
      className={cn(
        'group flex touch-manipulation select-none flex-col gap-2 rounded-xl p-2 transition-colors hover:bg-row-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        selected && 'bg-accent-tint-bg hover:bg-accent-tint-bg',
        // Como en la lista (§6.3): solo las carpetas son clicables
        isFolder && 'cursor-pointer',
        isOver && 'bg-accent-tint-bg ring-1 ring-accent hover:bg-accent-tint-bg',
        isDragging && 'opacity-40',
      )}
    >
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-surface">
        <FileThumbnail item={item} />
        <SelectCheckbox
          checked={selected}
          onToggle={(event) => onSelect(item, { shift: event.shiftKey })}
          label={`${selected ? 'Deseleccionar' : 'Seleccionar'} ${item.name}`}
          className={cn(
            'absolute left-2 top-2',
            !selected && !selectionActive && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
          )}
        />
        <ItemActionsMenu
          item={item}
          onDownload={onDownload}
          onRename={onRename}
          onMove={onMove}
          onDelete={onDelete}
          className="absolute right-1.5 top-1.5"
          triggerClassName="bg-card text-text-secondary shadow-sm opacity-0 hover:bg-surface-alt group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
        />
      </div>
      <div className="min-w-0 px-1">
        {/* title: en cuadrícula el nombre se trunca antes que en la lista, que sí lo muestra largo */}
        <p className="truncate text-sm text-text-primary" title={item.name}>
          {item.name}
        </p>
        <p className="truncate text-xs text-text-muted-2">{item.kind === 'file' ? formatBytes(item.sizeBytes) : 'Carpeta'}</p>
      </div>
    </div>
  )
}

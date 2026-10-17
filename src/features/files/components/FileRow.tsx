import { formatBytes } from '@/shared/lib/formatBytes'
import { formatShortDate } from '@/shared/lib/formatDate'
import { cn } from '@/shared/lib/utils'

import { useExplorerItemInteraction } from '../useExplorerItemInteraction'
import { ItemActionsMenu } from './ItemActionsMenu'
import { ItemIcon } from './ItemIcon'
import type { ExplorerItemViewProps } from './itemViewProps'
import { SelectCheckbox } from './SelectCheckbox'

// CLAUDE.md §6.3: fila unificada — carpeta y archivo comparten estructura,
// diferenciados solo por el icono. Toda la fila de una carpeta es clicable
// para entrar, sin chevron de afordancia. Drag & drop con dnd-kit (sensores
// de puntero, §7.5): los archivos son arrastrables; las carpetas, destinos.
// Selección múltiple (§6.3): casilla a la izquierda (visible al pasar el ratón,
// con la selección activa y siempre en táctil), y Ctrl/Cmd+clic o Shift+clic en
// cualquier parte de la fila — que entonces NO entra en la carpeta. La
// interacción vive en useExplorerItemInteraction, compartida con FileCard (§6.3b).
export function FileRow({
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
        // touch-manipulation (no touch-none): conserva el scroll táctil de la
        // lista (§10) — en táctil, mover archivos tiene su alternativa en
        // "Mover a…" (§11)
        'group flex touch-manipulation select-none items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-row-hover',
        // §6.3: fila seleccionada — tinte de acento (el resaltado de "carpeta destino" de abajo añade además el anillo)
        selected && 'bg-accent-tint-bg hover:bg-accent-tint-bg',
        // §6.1 (--row-hover): el sombreado se aplica a carpetas y archivos; solo las carpetas son clicables
        isFolder && 'cursor-pointer focus-visible:bg-row-hover focus-visible:outline-none',
        // §6.3: resaltar la carpeta mientras un archivo se arrastra encima
        isOver && 'bg-accent-tint-bg ring-1 ring-accent hover:bg-accent-tint-bg',
        isDragging && 'opacity-40',
      )}
    >
      <SelectCheckbox
        checked={selected}
        onToggle={(event) => onSelect(item, { shift: event.shiftKey })}
        label={`${selected ? 'Deseleccionar' : 'Seleccionar'} ${item.name}`}
        className={cn(
          // Oculta hasta que haga falta; accesible por teclado (focus) y en táctil (sin hover)
          !selected && !selectionActive && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
        )}
      />
      <ItemIcon item={item} />
      <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{item.name}</span>
      <span className="hidden w-20 shrink-0 text-right text-sm text-text-muted-2 sm:block">
        {item.kind === 'file' ? formatBytes(item.sizeBytes) : '—'}
      </span>
      <span className="hidden w-24 shrink-0 text-right text-sm text-text-muted-2 md:block">
        {formatShortDate(item.createdAt)}
      </span>

      <ItemActionsMenu
        item={item}
        onDownload={onDownload}
        onRename={onRename}
        onMove={onMove}
        onDelete={onDelete}
      />
    </div>
  )
}

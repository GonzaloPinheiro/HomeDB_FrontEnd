import { Download, Eye, FolderInput, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import type { MouseEvent } from 'react'

import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { cn } from '@/shared/lib/utils'

import type { ExplorerItem } from '../types'
import { isViewableFile } from '../viewer/media'

type ItemActionsMenuProps = {
  item: ExplorerItem
  onOpen: (item: ExplorerItem) => void
  onDownload: (item: ExplorerItem) => void
  onRename: (item: ExplorerItem) => void
  onMove: (item: ExplorerItem) => void
  onDelete: (item: ExplorerItem) => void
  /** Clases del contenedor (en la tarjeta de miniatura lo coloca sobre la esquina). */
  className?: string
  /** Clases del botón (en la tarjeta de miniatura le da fondo y visibilidad al pasar el ratón). */
  triggerClassName?: string
}

const stop = (event: MouseEvent) => event.stopPropagation()

// Menú contextual: Ver (imagen/vídeo) / Descargar / Mover a… / Renombrar / Eliminar, común a la fila
// de lista y a la tarjeta de miniatura (§6.3b). Mover y renombrar archivos van
// detrás de FILE_MOVE_ENABLED (§7.5). El contenedor detiene el clic: el
// contenido del menú va en un portal pero propaga el evento por el árbol de
// React, y sin esto elegir una acción en una carpeta además entraría en ella.
export function ItemActionsMenu({
  item,
  onOpen,
  onDownload,
  onRename,
  onMove,
  onDelete,
  className,
  triggerClassName,
}: ItemActionsMenuProps) {
  return (
    <div onClick={stop} className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            // CLAUDE.md §10/§11: icono visual compacto, área táctil real ~44px vía pseudo-elemento
            className={cn(
              "relative h-8 w-8 text-text-faint after:absolute after:-inset-1.5 after:content-[''] hover:text-text-primary",
              triggerClassName,
            )}
            aria-label={`Acciones de ${item.name}`}
          >
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* §6.3c: alternativa al clic para abrir el visor (teclado, táctil) */}
          {isViewableFile(item) && (
            <DropdownMenuItem onSelect={() => onOpen(item)}>
              <Eye />
              Ver
            </DropdownMenuItem>
          )}
          {item.kind === 'file' && (
            <>
              <DropdownMenuItem onSelect={() => onDownload(item)}>
                <Download />
                Descargar
              </DropdownMenuItem>
              {/* CLAUDE.md §11: alternativa sin arrastrar, necesaria para teclado/táctil */}
              <DropdownMenuItem onSelect={() => onMove(item)}>
                <FolderInput />
                Mover a…
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onSelect={() => onRename(item)}>
            <Pencil />
            Renombrar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDelete(item)} className="text-critical-text">
            <Trash2 />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

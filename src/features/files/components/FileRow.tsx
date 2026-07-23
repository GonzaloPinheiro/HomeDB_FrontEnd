import { useDraggable, useDroppable } from '@dnd-kit/core'
import {
  Download,
  FileArchive,
  FileAudio,
  FileImage,
  File as FileIcon,
  FileText,
  FileVideo,
  Folder,
  FolderInput,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react'
import type { KeyboardEvent, MouseEvent } from 'react'

import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { formatBytes } from '@/shared/lib/formatBytes'
import { formatShortDate } from '@/shared/lib/formatDate'
import { cn } from '@/shared/lib/utils'

import type { ExplorerItem } from '../types'

// Componente estático (no un componente creado en render): el tipo de archivo
// se transmite solo con el icono — no hay columna "Tipo" (§6.3)
export function ItemIcon({ item, className }: { item: ExplorerItem; className?: string }) {
  if (item.kind === 'folder') {
    return <Folder className={cn('h-5 w-5 shrink-0 text-accent', className)} aria-hidden />
  }
  const classes = cn('h-5 w-5 shrink-0 text-text-muted', className)
  const contentType = item.contentType
  if (contentType.startsWith('image/')) return <FileImage className={classes} aria-hidden />
  if (contentType.startsWith('video/')) return <FileVideo className={classes} aria-hidden />
  if (contentType.startsWith('audio/')) return <FileAudio className={classes} aria-hidden />
  if (contentType === 'application/pdf' || contentType.startsWith('text/')) {
    return <FileText className={classes} aria-hidden />
  }
  if (contentType.includes('zip') || contentType.includes('compressed')) {
    return <FileArchive className={classes} aria-hidden />
  }
  return <FileIcon className={classes} aria-hidden />
}

type FileRowProps = {
  item: ExplorerItem
  onEnterFolder: (item: ExplorerItem) => void
  onDownload: (item: ExplorerItem) => void
  onRename: (item: ExplorerItem) => void
  onMove: (item: ExplorerItem) => void
  onDelete: (item: ExplorerItem) => void
}

// CLAUDE.md §6.3: fila unificada — carpeta y archivo comparten estructura,
// diferenciados solo por el icono. Toda la fila de una carpeta es clicable
// para entrar, sin chevron de afordancia. Drag & drop con dnd-kit (sensores
// de puntero, §7.5): los archivos son arrastrables; las carpetas, destinos.
export function FileRow({ item, onEnterFolder, onDownload, onRename, onMove, onDelete }: FileRowProps) {
  const isFolder = item.kind === 'folder'

  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({
    id: `file-${item.id}`,
    disabled: isFolder, // solo archivos se arrastran en esta fase (carpetas: Fase futura)
    data: { item },
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `folder-${item.id}`,
    disabled: !isFolder,
    data: { type: 'folder', folderId: item.id },
  })

  const activate = () => {
    if (isFolder) onEnterFolder(item)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (isFolder && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      activate()
    }
  }

  const stop = (event: MouseEvent) => event.stopPropagation()

  return (
    <div
      ref={(element) => {
        setDragRef(element)
        setDropRef(element)
      }}
      role={isFolder ? 'button' : undefined}
      tabIndex={isFolder ? 0 : undefined}
      onClick={activate}
      onKeyDown={onKeyDown}
      // Listeners/atributos de arrastre solo en archivos: una carpeta (draggable
      // deshabilitado) no debe heredar aria-disabled ni listeners inertes
      {...(isFolder ? {} : { ...listeners, ...attributes })}
      className={cn(
        // touch-manipulation (no touch-none): conserva el scroll táctil de la
        // lista (§10) — en táctil, mover archivos tiene su alternativa en
        // "Mover a…" (§11)
        'group flex touch-manipulation items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
        isFolder &&
          'cursor-pointer hover:bg-surface-alt focus-visible:bg-surface-alt focus-visible:outline-none',
        // §6.3: resaltar la carpeta mientras un archivo se arrastra encima
        isOver && 'bg-accent-tint-bg ring-1 ring-accent',
        isDragging && 'opacity-40',
      )}
    >
      <ItemIcon item={item} />
      <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{item.name}</span>
      <span className="hidden w-20 shrink-0 text-right text-sm text-text-muted-2 sm:block">
        {item.kind === 'file' ? formatBytes(item.sizeBytes) : '—'}
      </span>
      <span className="hidden w-24 shrink-0 text-right text-sm text-text-muted-2 md:block">
        {formatShortDate(item.createdAt)}
      </span>

      {/* Menú contextual: Descargar / Mover a… / Renombrar / Eliminar.
          Mover y renombrar archivos van detrás de FILE_MOVE_ENABLED (§7.5) —
          la UI se ofrece igual y termina en toast informativo mientras el
          endpoint no exista. */}
      <div onClick={stop}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              // CLAUDE.md §10/§11: icono visual compacto, área táctil real ~44px vía pseudo-elemento
              className="relative h-8 w-8 text-text-faint after:absolute after:-inset-1.5 after:content-[''] hover:text-text-primary"
              aria-label={`Acciones de ${item.name}`}
            >
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
    </div>
  )
}

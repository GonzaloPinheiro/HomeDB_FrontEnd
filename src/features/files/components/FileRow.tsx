import {
  Download,
  FileArchive,
  FileAudio,
  FileImage,
  File as FileIcon,
  FileText,
  FileVideo,
  Folder,
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
function ItemIcon({ item }: { item: ExplorerItem }) {
  if (item.kind === 'folder') {
    return <Folder className="h-5 w-5 shrink-0 text-accent" aria-hidden />
  }
  const className = 'h-5 w-5 shrink-0 text-text-muted'
  const contentType = item.contentType
  if (contentType.startsWith('image/')) return <FileImage className={className} aria-hidden />
  if (contentType.startsWith('video/')) return <FileVideo className={className} aria-hidden />
  if (contentType.startsWith('audio/')) return <FileAudio className={className} aria-hidden />
  if (contentType === 'application/pdf' || contentType.startsWith('text/')) {
    return <FileText className={className} aria-hidden />
  }
  if (contentType.includes('zip') || contentType.includes('compressed')) {
    return <FileArchive className={className} aria-hidden />
  }
  return <FileIcon className={className} aria-hidden />
}

type FileRowProps = {
  item: ExplorerItem
  onEnterFolder: (item: ExplorerItem) => void
  onDownload: (item: ExplorerItem) => void
  onRename: (item: ExplorerItem) => void
  onDelete: (item: ExplorerItem) => void
}

// CLAUDE.md §6.3: fila unificada — carpeta y archivo comparten estructura,
// diferenciados solo por el icono. Toda la fila de una carpeta es clicable
// para entrar, sin chevron de afordancia.
export function FileRow({ item, onEnterFolder, onDownload, onRename, onDelete }: FileRowProps) {
  const isFolder = item.kind === 'folder'

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
      role={isFolder ? 'button' : undefined}
      tabIndex={isFolder ? 0 : undefined}
      onClick={activate}
      onKeyDown={onKeyDown}
      className={cn(
        'group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
        isFolder && 'cursor-pointer hover:bg-surface-alt focus-visible:bg-surface-alt focus-visible:outline-none',
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

      {/* Menú contextual — Fase 2a: Descargar / Renombrar / Eliminar.
          PENDIENTE (Fase 2b): acción "Mover a…" (CLAUDE.md §11).
          PENDIENTE (CLAUDE.md §5.4): renombrar archivos no tiene endpoint aún —
          solo las carpetas ofrecen Renombrar. */}
      <div onClick={stop}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-text-faint hover:text-text-primary"
              aria-label={`Acciones de ${item.name}`}
            >
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {item.kind === 'file' && (
              <DropdownMenuItem onSelect={() => onDownload(item)}>
                <Download />
                Descargar
              </DropdownMenuItem>
            )}
            {isFolder && (
              <DropdownMenuItem onSelect={() => onRename(item)}>
                <Pencil />
                Renombrar
              </DropdownMenuItem>
            )}
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

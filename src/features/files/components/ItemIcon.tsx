import {
  FileArchive,
  FileAudio,
  FileImage,
  File as FileIcon,
  FileText,
  FileVideo,
  Folder,
} from 'lucide-react'

import { cn } from '@/shared/lib/utils'

import type { ExplorerItem } from '../types'

// Componente estático (no un componente creado en render): el tipo de archivo
// se transmite solo con el icono — no hay columna "Tipo" (§6.3). Compartido por
// la vista de lista, la de miniaturas (§6.3b) y la vista fantasma del arrastre.
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

import {
  Captions,
  Disc,
  File as FileIcon,
  FileText,
  Film,
  Image as ImageIcon,
  Music,
  type LucideIcon,
} from 'lucide-react'

import { formatBytes } from '@/shared/lib/formatBytes'
import { cn } from '@/shared/lib/utils'

import { getFileKind, type FileKind } from '../presentation'
import type { TorrentFile } from '../types'
import { FileRoleMenu } from './FileRoleMenu'

const KIND_ICONS: Record<FileKind, LucideIcon> = {
  video: Film,
  subtitle: Captions,
  audio: Music,
  image: ImageIcon,
  archive: Disc,
  document: FileText,
  other: FileIcon,
}

// CLAUDE.md §6.19: un fichero del torrent — icono por tipo, nombre, tamaño y, si el
// torrent es de vídeo, el selector de su rol. Un fichero marcado «No descargar» se
// atenúa para que se vea de un vistazo qué se queda fuera.
export function TorrentFileRow({ file }: { file: TorrentFile }) {
  const Icon = KIND_ICONS[getFileKind(file.name)]
  const skipped = file.role === 'skip'

  return (
    <li className={cn('flex items-center gap-3 rounded-lg px-3 py-2', skipped && 'opacity-60')}>
      <Icon className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
      <div className="min-w-0 flex-1">
        {/* Hasta dos líneas: en móvil el selector de rol deja poco ancho y el nombre es lo que identifica el fichero */}
        <p className="line-clamp-2 text-sm font-medium text-text-primary [overflow-wrap:anywhere]" title={file.name}>
          {file.name}
        </p>
        <p className="font-mono text-[11px] text-text-muted">{formatBytes(file.sizeBytes)}</p>
      </div>
      {file.role !== null && <FileRoleMenu file={file} role={file.role} />}
    </li>
  )
}

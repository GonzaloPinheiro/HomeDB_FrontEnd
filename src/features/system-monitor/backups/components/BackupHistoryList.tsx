import { formatBytes } from '@/shared/lib/formatBytes'
import { formatDuration } from '@/shared/lib/formatDuration'
import { formatDateTime, formatShortDateTime } from '@/shared/lib/formatDate'

import { totalBackupBytes } from '../summary'
import type { BackupEntry } from '../types'
import { BackupStatusBadge } from './BackupStatusBadge'

function entryMeta(entry: BackupEntry): string {
  const parts: string[] = []
  if (entry.status === 'success') parts.push(formatBytes(totalBackupBytes(entry)))
  if (entry.completedAt !== null) {
    parts.push(formatDuration(Date.parse(entry.completedAt) - Date.parse(entry.startedAt)))
  }
  // Solo se conservan las dos últimas copias físicas (BackupService): un registro
  // con `deletedAt` sigue en el historial como auditoría, pero su copia ya no existe.
  if (entry.deletedAt !== null) parts.push('copia reemplazada')
  return parts.join(' · ')
}

// Historial reciente: una fila compacta por ejecución, del panel lateral de Disco.
export function BackupHistoryList({ items }: { items: readonly BackupEntry[] }) {
  return (
    <ul className="flex flex-col">
      {items.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-1 border-b border-border-light py-2 last:border-b-0">
          <div className="flex items-center justify-between gap-2">
            <time dateTime={entry.startedAt} title={formatDateTime(entry.startedAt)} className="text-xs text-text-primary">
              {formatShortDateTime(entry.startedAt)}
            </time>
            <BackupStatusBadge status={entry.status} className="px-2 py-0 text-[11px]" />
          </div>
          {entryMeta(entry) && <span className="text-xs text-text-muted-2">{entryMeta(entry)}</span>}
          {entry.status === 'failed' && entry.errorMessage && (
            // Mensaje crudo del proceso (rsync/pg_dump), en inglés y a veces largo:
            // acotado a 2 líneas, completo en el tooltip nativo.
            <p className="line-clamp-2 break-words text-xs text-critical-text" title={entry.errorMessage}>
              {entry.errorMessage}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

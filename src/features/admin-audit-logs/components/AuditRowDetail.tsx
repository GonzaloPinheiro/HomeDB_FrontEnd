import { CopyButton } from '@/shared/components/CopyButton'
import { DetailField, DetailGrid } from '@/shared/components/DetailGrid'
import { formatDateTime } from '@/shared/lib/formatDate'

import { actionLabel } from '../actions'
import type { AuditLogEntry } from '../types'

// CLAUDE.md §6.8: despliegue inline de fila, sin modal — TODOS los campos
// reales de la entidad AuditLogEntry, tal cual la devuelve el backend. La acción lleva su etiqueta legible
// Y el código real, que es lo que se filtra en el backend.
export function AuditRowDetail({ entry }: { entry: AuditLogEntry }) {
  return (
    <DetailGrid>
      <DetailField label="Id">{entry.id}</DetailField>
      <DetailField label="Timestamp">{formatDateTime(entry.timeStamp)}</DetailField>
      <DetailField label="UserId">{entry.userId}</DetailField>
      <DetailField label="Usuario">{entry.username}</DetailField>
      <DetailField label="IP">
        {entry.ipAddress ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{entry.ipAddress}</span>
            <CopyButton value={entry.ipAddress} />
          </div>
        ) : (
          '—'
        )}
      </DetailField>
      <DetailField label="Acción">
        {actionLabel(entry.action)} · <span className="font-mono text-xs text-text-secondary">{entry.action}</span>
      </DetailField>
      <DetailField label="Tipo de recurso">{entry.resourceType ?? '—'}</DetailField>
      <DetailField label="ResourceId">{entry.resourceId ?? '—'}</DetailField>
      <DetailField label="Nombre del recurso" full>
        {entry.resourceName ?? '—'}
      </DetailField>
    </DetailGrid>
  )
}

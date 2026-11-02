import { Route } from 'lucide-react'

import { CopyButton } from '@/shared/components/CopyButton'
import { DetailField, DetailGrid } from '@/shared/components/DetailGrid'
import { Button } from '@/shared/components/ui/button'
import { formatDateTime } from '@/shared/lib/formatDate'

import type { LogEntry } from '../types'

type LogRowDetailProps = {
  log: LogEntry
  /**
   * Muestra solo los registros de una petición. Cada petición escribe varias entradas (entrada, salida,
   * avisos, excepción) con el mismo CorrelationId, y seguirlas juntas es lo que de verdad ayuda a
   * entender un fallo.
   */
  onShowRequest: (correlationId: string) => void
}

// CLAUDE.md §6.8: despliegue inline de fila, sin modal — TODOS los campos de
// LogEntryDto, sin resumir. La excepción va en bloque monoespaciado con altura
// máxima fija y scroll propio, más botón de copiar (§11).
export function LogRowDetail({ log, onShowRequest }: LogRowDetailProps) {
  return (
    <DetailGrid>
      <DetailField label="Id">{log.id}</DetailField>
      <DetailField label="Timestamp">{formatDateTime(log.timeStamp)}</DetailField>
      <DetailField label="Nivel">{log.level}</DetailField>
      <DetailField label="Origen">{log.source}</DetailField>
      <DetailField label="Operación">
        <span className="font-mono text-xs">{log.operation}</span>
      </DetailField>
      <DetailField label="Duración">{log.durationMs} ms</DetailField>
      <DetailField label="Usuario">{log.userId || '—'}</DetailField>
      <DetailField label="CorrelationId">
        <div className="flex flex-wrap items-center gap-2">
          <span className="break-all font-mono text-xs">{log.correlationId || '—'}</span>
          {log.correlationId && (
            <Button type="button" variant="outline" size="sm" onClick={() => onShowRequest(log.correlationId)}>
              <Route aria-hidden />
              Ver toda la petición
            </Button>
          )}
        </div>
      </DetailField>
      <DetailField label="Mensaje" full>
        {log.message || '—'}
      </DetailField>
      {log.exception && (
        <DetailField label="Excepción" full>
          <div className="flex flex-col gap-2">
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-card p-3">
              <pre className="whitespace-pre-wrap break-words font-mono text-xs text-text-primary">
                {log.exception}
              </pre>
            </div>
            <CopyButton value={log.exception} className="self-start" />
          </div>
        </DetailField>
      )}
    </DetailGrid>
  )
}

import { Ban, Check, ChevronDown, ChevronRight, CircleAlert, Folder, Hourglass, RotateCcw, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'

import { Modal } from '@/shared/components/Modal'
import { Button } from '@/shared/components/ui/button'
import { Progress } from '@/shared/components/ui/progress'
import { formatBytes } from '@/shared/lib/formatBytes'
import { cn } from '@/shared/lib/utils'

import { useUploadQueue } from '../uploadQueue/UploadQueueContext'
import type { ChunkStatus, UploadQueueEntry } from '../uploadQueue/types'

// CLAUDE.md §6.4/§6.5/§6.16: panel único de subidas, montado una vez en
// AppShell (sin props) — lee siempre del UploadQueueProvider global, nunca de
// estado local, para sobrevivir a cerrarse. Con `activeTarget` presente
// (abierto desde "Subir" en Archivos) admite soltar/elegir archivos nuevos;
// sin él (abierto desde la bandeja persistente en otra pantalla, §6.16) es
// solo de consulta sobre lo que ya hay en curso.
//
// Cambio deliberado respecto al diseño original de §6.4: ya no hay un botón
// de confirmar el lote ("Subir 3 archivos") antes de empezar. Al soltar o
// elegir un archivo entra directamente en la cola persistente y arranca en
// cuanto hay hueco (§7.4) — la ventana de "quitarlo antes de subir" que daba
// ese botón queda cubierta de sobra por poder cancelar cualquier entrada en
// cualquier momento (en cola o ya subiendo), algo que el diseño anterior no
// permitía una vez pulsado "Subir".
export function UploadModal() {
  const {
    entries,
    isPanelOpen,
    rateLimitedUntil,
    activeTarget,
    closePanel,
    addFiles,
    cancelEntry,
    retryEntry,
    retryAllFailed,
    removeEntry,
  } = useUploadQueue()
  const [isDragOver, setIsDragOver] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) addFiles(Array.from(event.target.files))
    event.target.value = ''
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
    if (event.dataTransfer.files.length) addFiles(Array.from(event.dataTransfer.files))
  }

  const activeCount = entries.filter((e) => e.status === 'queued' || e.status === 'uploading').length
  const doneCount = entries.filter((e) => e.status === 'done').length
  // Solo 'error': las 'cancelled' las canceló el usuario a propósito, no "fallaron".
  const failedCount = entries.filter((e) => e.status === 'error').length

  return (
    <Modal
      open={isPanelOpen}
      onOpenChange={(value) => !value && closePanel()}
      title={activeTarget ? 'Subir archivos' : 'Subidas'}
      size="small"
    >
      <div className="flex flex-col gap-4">
        {activeTarget ? (
          <>
            {/* Carpeta destino (§6.4) */}
            <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm">
              <span className="text-text-secondary">Subiendo a</span>
              <Folder className="h-4 w-4 text-accent" aria-hidden />
              <span className="truncate font-medium text-text-primary">{activeTarget.folderName}</span>
            </div>

            {/* Zona de arrastre + selección por clic */}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={onDrop}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-sm transition-colors',
                isDragOver
                  ? 'border-accent bg-accent-tint-bg text-accent-tint-text'
                  : 'border-border text-text-secondary hover:border-text-faint',
              )}
            >
              <Upload className="h-5 w-5" aria-hidden />
              Arrastra archivos aquí o haz clic para elegirlos
            </button>
            <input ref={inputRef} type="file" multiple hidden onChange={onInputChange} />
          </>
        ) : entries.length > 0 ? (
          // CLAUDE.md §6.16: panel abierto desde la bandeja en otra pantalla — solo consulta.
          <p className="text-xs text-text-muted">Ve a Archivos para añadir más archivos.</p>
        ) : null}

        {/* Pausa global por rate limit (§7.4) — las subidas se reanudan solas */}
        {rateLimitedUntil !== null && <RateLimitNotice until={rateLimitedUntil} />}

        {/* Reintentar todos los fallidos de una vez, en vez de uno por uno */}
        {failedCount > 0 && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-critical-text">
              {failedCount} {failedCount === 1 ? 'archivo con error' : 'archivos con error'}
            </span>
            <Button variant="outline" size="sm" onClick={retryAllFailed}>
              <RotateCcw aria-hidden />
              Reintentar {failedCount === 1 ? 'el fallido' : 'todos'}
            </Button>
          </div>
        )}

        {/* Filas de archivos */}
        {entries.length > 0 && (
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {entries.map((entry) => (
              <UploadEntryRow
                key={entry.id}
                entry={entry}
                expanded={expandedId === entry.id}
                onToggleExpand={() => setExpandedId((current) => (current === entry.id ? null : entry.id))}
                onCancel={() => cancelEntry(entry.id)}
                onRetry={() => retryEntry(entry.id)}
                onRemove={() => removeEntry(entry.id)}
              />
            ))}
          </ul>
        )}

        {/* Pie: resumen (§6.4) — sin botón de acción, ver nota arriba */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-text-secondary">
            {entries.length > 0 ? `${doneCount} de ${entries.length} completado${entries.length === 1 ? '' : 's'}` : ''}
          </span>
          <Button variant="outline" onClick={closePanel}>
            {activeCount > 0 ? 'Ocultar' : 'Cerrar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// CLAUDE.md §7.4: aviso de la pausa por rate limit (429). Cuenta atrás local —
// el Provider solo guarda el instante de reanudación, no re-renderiza cada segundo.
function RateLimitNotice({ until }: { until: number }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const secondsLeft = Math.max(0, Math.ceil((until - now) / 1000))

  return (
    <div role="status" className="flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning-text">
      <Hourglass className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        Demasiadas peticiones al servidor. Las subidas están en pausa y se reanudarán solas
        {secondsLeft > 0 ? ` en ${secondsLeft} s` : ' en un instante'}.
      </span>
    </div>
  )
}

const CHUNK_STATUS_CLASS: Record<ChunkStatus, string> = {
  pending: 'bg-border-light',
  uploading: 'bg-accent animate-pulse',
  done: 'bg-accent',
  error: 'bg-critical-text',
}

type UploadEntryRowProps = {
  entry: UploadQueueEntry
  expanded: boolean
  onToggleExpand: () => void
  onCancel: () => void
  onRetry: () => void
  onRemove: () => void
}

function UploadEntryRow({ entry, expanded, onToggleExpand, onCancel, onRetry, onRemove }: UploadEntryRowProps) {
  // CLAUDE.md §6.4/§6.16: el detalle por chunk solo aporta con más de uno —
  // un archivo pequeño (1 chunk) se queda con la barra simple de siempre.
  const canExpand = entry.totalChunks > 1 && entry.chunks.length > 0

  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-border-light px-3 py-2">
      <div className="flex items-center gap-2">
        {canExpand ? (
          <button
            type="button"
            onClick={onToggleExpand}
            className="shrink-0 text-text-muted hover:text-text-primary"
            aria-label={expanded ? 'Ocultar detalle de fragmentos' : 'Ver detalle de fragmentos'}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4 shrink-0" aria-hidden />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm text-text-primary">{entry.file.name}</span>
            <span className="shrink-0 text-xs text-text-muted-2">{formatBytes(entry.file.size)}</span>
          </div>
          <span className="block truncate text-xs text-text-muted-2">→ {entry.folderName}</span>

          {entry.status === 'queued' && <span className="text-xs text-text-muted">En cola</span>}
          {entry.status === 'uploading' && (
            <div className="mt-1 flex items-center gap-2">
              <Progress value={entry.progress} className="h-1.5" />
              <span className="w-9 shrink-0 text-right text-xs text-text-secondary">{entry.progress}%</span>
            </div>
          )}
          {entry.status === 'error' && (
            <span className="flex items-center gap-1 text-xs text-critical-text">
              <CircleAlert className="h-3 w-3 shrink-0" aria-hidden />
              {entry.error}
            </span>
          )}
          {entry.status === 'cancelled' && (
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Ban className="h-3 w-3 shrink-0" aria-hidden />
              Cancelada
            </span>
          )}
        </div>

        {/* Acciones — según estado (§6.4/§11) */}
        <div className="flex shrink-0 items-center gap-1">
          {(entry.status === 'error' || entry.status === 'cancelled') && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded p-0.5 text-text-muted hover:bg-surface-alt hover:text-text-primary"
              aria-label={`Reintentar ${entry.file.name}`}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          {(entry.status === 'queued' || entry.status === 'uploading') && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded p-0.5 text-text-muted hover:bg-surface-alt hover:text-text-primary"
              aria-label={`Cancelar ${entry.file.name}`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {entry.status === 'done' && <Check className="h-4 w-4 shrink-0 text-accent" aria-label="Completado" />}
          {(entry.status === 'done' || entry.status === 'error' || entry.status === 'cancelled') && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded p-0.5 text-text-muted hover:bg-surface-alt hover:text-text-primary"
              aria-label={`Quitar ${entry.file.name} de la lista`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Detalle por chunk (§6.4/§6.16): una tira de fragmentos, uno por chunk */}
      {canExpand && expanded && (
        <div className="ml-6 flex flex-wrap gap-1" role="img" aria-label={`${entry.totalChunks} fragmentos`}>
          {entry.chunks.map((status, index) => (
            <span
              key={index}
              title={`Fragmento ${index + 1} de ${entry.totalChunks}: ${status}`}
              className={cn('h-2.5 w-3.5 rounded-sm', CHUNK_STATUS_CLASS[status])}
            />
          ))}
        </div>
      )}
    </li>
  )
}

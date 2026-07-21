import { Check, CircleAlert, Folder, Loader2, Upload, X } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'

import { toApiError } from '@/shared/api/client'
import { Modal } from '@/shared/components/Modal'
import { Button } from '@/shared/components/ui/button'
import { Progress } from '@/shared/components/ui/progress'
import { formatBytes } from '@/shared/lib/formatBytes'
import { cn } from '@/shared/lib/utils'

import { useUploadFile } from '../api'

type EntryStatus = 'queued' | 'uploading' | 'done' | 'error'

type UploadEntry = {
  key: string
  file: File
  status: EntryStatus
  progress: number
  error?: string
}

type UploadModalProps = {
  open: boolean
  onClose: () => void
  folderId: number | null
  folderName: string
}

// CLAUDE.md §6.4: modal de subida — carpeta destino arriba, zona de arrastre
// multi-archivo, cada archivo con su fila/estado/progreso y una x para quitarlo
// antes de subir; pie con resumen y botón con recuento.
export function UploadModal({ open, onClose, folderId, folderName }: UploadModalProps) {
  const upload = useUploadFile()
  const [entries, setEntries] = useState<UploadEntry[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const patchEntry = (key: string, patch: Partial<UploadEntry>) => {
    setEntries((current) => current.map((e) => (e.key === key ? { ...e, ...patch } : e)))
  }

  const addFiles = (files: FileList | File[]) => {
    const added = Array.from(files).map<UploadEntry>((file) => ({
      key: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      file,
      status: 'queued',
      progress: 0,
    }))
    setEntries((current) => [...current, ...added])
  }

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) addFiles(event.target.files)
    event.target.value = ''
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
    if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files)
  }

  const startUpload = () => {
    // Llamadas independientes EN PARALELO, cada una con su propio progreso (§6.5)
    for (const entry of entries.filter((e) => e.status === 'queued')) {
      patchEntry(entry.key, { status: 'uploading', progress: 0 })
      upload
        .mutateAsync({
          file: entry.file,
          folderId,
          onProgress: (percent) => patchEntry(entry.key, { progress: percent }),
        })
        .then(() => patchEntry(entry.key, { status: 'done', progress: 100 }))
        .catch((error: unknown) =>
          patchEntry(entry.key, { status: 'error', error: toApiError(error).message }),
        )
    }
  }

  const isUploading = entries.some((e) => e.status === 'uploading')
  const queuedCount = entries.filter((e) => e.status === 'queued').length
  const doneCount = entries.filter((e) => e.status === 'done').length

  const close = () => {
    if (isUploading) return // no cerrar con subidas en curso
    setEntries([])
    onClose()
  }

  return (
    <Modal open={open} onOpenChange={(value) => !value && close()} title="Subir archivos" size="small">
      <div className="flex flex-col gap-4">
        {/* Carpeta destino (§6.4) */}
        <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm">
          <span className="text-text-secondary">Subiendo a</span>
          <Folder className="h-4 w-4 text-accent" aria-hidden />
          <span className="truncate font-medium text-text-primary">{folderName}</span>
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

        {/* Filas de archivos */}
        {entries.length > 0 && (
          <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto">
            {entries.map((entry) => (
              <li key={entry.key} className="flex items-center gap-2 rounded-lg border border-border-light px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm text-text-primary">{entry.file.name}</span>
                    <span className="shrink-0 text-xs text-text-muted-2">{formatBytes(entry.file.size)}</span>
                  </div>
                  {entry.status === 'queued' && <span className="text-xs text-text-muted">En cola</span>}
                  {entry.status === 'uploading' && (
                    <div className="mt-1 flex items-center gap-2">
                      <Progress value={entry.progress} className="h-1.5" />
                      <span className="w-9 shrink-0 text-right text-xs text-text-secondary">
                        {entry.progress}%
                      </span>
                    </div>
                  )}
                  {entry.status === 'error' && (
                    <span className="flex items-center gap-1 text-xs text-critical-text">
                      <CircleAlert className="h-3 w-3" aria-hidden />
                      {entry.error}
                    </span>
                  )}
                </div>
                {entry.status === 'done' ? (
                  <Check className="h-4 w-4 shrink-0 text-accent" aria-label="Completado" />
                ) : entry.status === 'queued' ? (
                  <button
                    type="button"
                    onClick={() => setEntries((current) => current.filter((e) => e.key !== entry.key))}
                    className="shrink-0 rounded p-0.5 text-text-muted hover:bg-surface-alt hover:text-text-primary"
                    aria-label={`Quitar ${entry.file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {/* Pie: resumen + botón con recuento (§6.4) */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-text-secondary">
            {entries.length > 0 ? `${doneCount} de ${entries.length} completado` : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={close} disabled={isUploading}>
              {doneCount > 0 && queuedCount === 0 && !isUploading ? 'Cerrar' : 'Cancelar'}
            </Button>
            <Button onClick={startUpload} disabled={queuedCount === 0 || isUploading}>
              {isUploading ? <Loader2 className="animate-spin" /> : null}
              {isUploading
                ? 'Subiendo…'
                : `Subir ${queuedCount} ${queuedCount === 1 ? 'archivo' : 'archivos'}`}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

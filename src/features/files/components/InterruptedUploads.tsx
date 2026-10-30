import { X } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/shared/components/ui/button'
import { formatBytes } from '@/shared/lib/formatBytes'

import { isSameFile } from '../uploadQueue/resumableUploads'
import { useUploadQueue } from '../uploadQueue/UploadQueueContext'
import type { InterruptedUpload } from '../uploadQueue/useInterruptedUploads'

// CLAUDE.md §6.4/§7.4: subidas que una visita anterior dejó a medias en el
// servidor. El archivo no sobrevive a una recarga (el navegador no lo conserva),
// así que reanudar exige que el usuario lo vuelva a dar: aquí se elige de nuevo y,
// si es el mismo, la cola reconoce la sesión y solo envía lo que falta. Soltarlo en
// cualquier zona de subida hace exactamente lo mismo — este botón solo evita tener
// que ir a buscar la carpeta de destino.
export function InterruptedUploads() {
  const { interruptedUploads, discardInterrupted, addFiles } = useUploadQueue()
  const inputRef = useRef<HTMLInputElement | null>(null)
  // Qué subida se está continuando mientras el selector del sistema está abierto.
  const [resuming, setResuming] = useState<InterruptedUpload | null>(null)

  if (interruptedUploads.length === 0) return null

  const openPicker = (upload: InterruptedUpload) => {
    setResuming(upload)
    inputRef.current?.click()
  }

  const onPicked = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !resuming) return

    // Otro archivo se subiría entero como uno nuevo y dejaría esta sesión sin tocar:
    // mejor decirlo que dejar al usuario sin saber por qué no "continúa".
    if (!isSameFile(resuming, file)) {
      toast.error(`Elige el mismo archivo: "${resuming.fileName}" (${formatBytes(resuming.size)})`)
      return
    }
    // La carpeta de destino es la de la sesión del servidor, no la que se esté viendo.
    addFiles([file], { folderId: resuming.folderId, folderName: resuming.folderName })
  }

  return (
    <section aria-label="Subidas interrumpidas" className="flex flex-col gap-2">
      <div>
        <h3 className="text-sm font-medium text-text-primary">Subidas interrumpidas</h3>
        <p className="text-xs text-text-muted">
          Quedaron a medias. Elige de nuevo el mismo archivo y continuará donde se quedó, sin
          repetir lo ya enviado.
        </p>
      </div>

      <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
        {interruptedUploads.map((upload) => (
          <li
            key={upload.sessionId}
            className="flex items-center gap-2 rounded-lg border border-border-light px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm text-text-primary">{upload.fileName}</span>
                <span className="shrink-0 text-xs text-text-muted-2">
                  {formatBytes(upload.size)}
                </span>
              </div>
              <span className="block truncate text-xs text-text-muted-2">
                → {upload.folderName}
              </span>
              <span className="text-xs text-text-secondary">
                {upload.receivedChunks} de {upload.totalChunks}{' '}
                {upload.totalChunks === 1 ? 'fragmento enviado' : 'fragmentos enviados'}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => openPicker(upload)}>
              Continuar
            </Button>
            <button
              type="button"
              onClick={() => discardInterrupted(upload.sessionId)}
              className="shrink-0 rounded p-0.5 text-text-muted hover:bg-surface-alt hover:text-text-primary"
              aria-label={`Descartar ${upload.fileName}`}
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <input ref={inputRef} type="file" hidden onChange={onPicked} />
    </section>
  )
}

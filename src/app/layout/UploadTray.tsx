import { CircleAlert, Loader2, UploadCloud } from 'lucide-react'

import { useUploadQueue } from '@/features/files/uploadQueue/UploadQueueContext'
import { usePermissions } from '@/shared/hooks/usePermissions'
import { formatBytes } from '@/shared/lib/formatBytes'

// CLAUDE.md §6.16: indicador persistente de subidas — visible en cualquier
// pantalla mientras haya entradas en la cola y el panel de detalle esté
// cerrado. Existe porque el estado vive en UploadQueueProvider (montado en
// AppShell, §7.4), no en el propio modal — una subida grande sigue corriendo
// aunque el usuario cierre el panel o navegue a otra sección; sin esta
// bandeja no habría forma de saberlo ni de volver a abrir el detalle.
export function UploadTray() {
  const { hasModule } = usePermissions()
  const { entries, interruptedUploads, isPanelOpen, openPanel } = useUploadQueue()

  // Los endpoints de subida exigen el módulo Files — sin él, la cola siempre
  // está vacía, pero se guarda explícito igual que StorageWidget (§6.12).
  if (!hasModule('Files') || isPanelOpen) return null

  // §7.4: tras recargar la cola está vacía, pero el servidor puede tener subidas a
  // medias. Sin este aviso no habría forma de enterarse ni de reanudarlas: solo se
  // muestra si no hay nada más, porque con entradas en la cola el panel ya las lista.
  if (entries.length === 0) {
    if (interruptedUploads.length === 0) return null
    const count = interruptedUploads.length
    return (
      <button
        type="button"
        onClick={() => openPanel()}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm text-text-primary shadow-md transition-colors hover:bg-surface-alt"
      >
        <CircleAlert className="h-4 w-4 shrink-0 text-warning-text" aria-hidden />
        {count === 1 ? '1 subida sin terminar' : `${count} subidas sin terminar`}
      </button>
    )
  }

  const activeEntries = entries.filter((e) => e.status === 'uploading' || e.status === 'queued')
  const uploadingEntries = entries.filter((e) => e.status === 'uploading')
  // CLAUDE.md §7.4: ya enviados por completo, el servidor los ensambla en segundo plano.
  const processingCount = entries.filter((e) => e.status === 'processing').length
  const errorCount = entries.filter((e) => e.status === 'error').length
  const isActive = activeEntries.length > 0
  const isBusy = isActive || processingCount > 0

  const avgProgress = uploadingEntries.length
    ? Math.round(uploadingEntries.reduce((sum, e) => sum + e.progress, 0) / uploadingEntries.length)
    : 0

  // CLAUDE.md §7.4: velocidad total = suma de la de cada archivo que se está enviando.
  const totalSpeed = uploadingEntries.reduce((sum, e) => sum + (e.speedBytesPerSec ?? 0), 0)
  const speedLabel = totalSpeed > 0 ? ` · ${formatBytes(totalSpeed)}/s` : ''

  const files = (count: number) => `${count} ${count === 1 ? 'archivo' : 'archivos'}`

  let label: string
  if (isActive) {
    const processingSuffix = processingCount > 0 ? ` · ${processingCount} en proceso` : ''
    label = `Subiendo ${files(activeEntries.length)} · ${avgProgress}%${speedLabel}${processingSuffix}`
  } else if (processingCount > 0) {
    label = `Procesando ${files(processingCount)} en el servidor`
  } else if (errorCount > 0) {
    label = `${files(errorCount)} con error al subir`
  } else {
    label = `${entries.length} ${entries.length === 1 ? 'archivo subido' : 'archivos subidos'}`
  }

  return (
    <button
      type="button"
      onClick={() => openPanel()}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm text-text-primary shadow-md transition-colors hover:bg-surface-alt"
    >
      {isBusy ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" aria-hidden />
      ) : errorCount > 0 ? (
        <CircleAlert className="h-4 w-4 shrink-0 text-critical-text" aria-hidden />
      ) : (
        <UploadCloud className="h-4 w-4 shrink-0 text-accent" aria-hidden />
      )}
      {label}
    </button>
  )
}

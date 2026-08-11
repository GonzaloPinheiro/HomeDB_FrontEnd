import { CircleAlert, Loader2, UploadCloud } from 'lucide-react'

import { useUploadQueue } from '@/features/files/uploadQueue/UploadQueueContext'
import { usePermissions } from '@/shared/hooks/usePermissions'

// CLAUDE.md §6.16: indicador persistente de subidas — visible en cualquier
// pantalla mientras haya entradas en la cola y el panel de detalle esté
// cerrado. Existe porque el estado vive en UploadQueueProvider (montado en
// AppShell, §7.4), no en el propio modal — una subida grande sigue corriendo
// aunque el usuario cierre el panel o navegue a otra sección; sin esta
// bandeja no habría forma de saberlo ni de volver a abrir el detalle.
export function UploadTray() {
  const { hasModule } = usePermissions()
  const { entries, isPanelOpen, openPanel } = useUploadQueue()

  // Los endpoints de subida exigen el módulo Files — sin él, la cola siempre
  // está vacía, pero se guarda explícito igual que StorageWidget (§6.12).
  if (!hasModule('Files') || entries.length === 0 || isPanelOpen) return null

  const activeEntries = entries.filter((e) => e.status === 'uploading' || e.status === 'queued')
  const uploadingEntries = entries.filter((e) => e.status === 'uploading')
  const errorCount = entries.filter((e) => e.status === 'error').length
  const isActive = activeEntries.length > 0

  const avgProgress = uploadingEntries.length
    ? Math.round(uploadingEntries.reduce((sum, e) => sum + e.progress, 0) / uploadingEntries.length)
    : 0

  const label = isActive
    ? `Subiendo ${activeEntries.length} ${activeEntries.length === 1 ? 'archivo' : 'archivos'} · ${avgProgress}%`
    : errorCount > 0
      ? `${errorCount} ${errorCount === 1 ? 'archivo' : 'archivos'} con error al subir`
      : `${entries.length} ${entries.length === 1 ? 'archivo subido' : 'archivos subidos'}`

  return (
    <button
      type="button"
      onClick={() => openPanel()}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm text-text-primary shadow-md transition-colors hover:bg-surface-alt"
    >
      {isActive ? (
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

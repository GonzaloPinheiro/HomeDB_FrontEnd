import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { toApiError } from '@/shared/api/client'

import { filesKeys } from '../api'
import {
  CHUNK_SIZE_BYTES,
  MAX_CONCURRENT_UPLOADS,
  aggregateProgress,
  completeUploadSession,
  computeChunkPlan,
  getUploadStatus,
  initUploadSession,
  uploadChunkWithRetry,
} from './pipeline'
import type { UploadQueueEntry, UploadTarget } from './types'

type UploadQueueContextValue = {
  entries: UploadQueueEntry[]
  isPanelOpen: boolean
  /** Presente = el panel puede añadir archivos nuevos a esa carpeta; ausente = solo consulta (abierto desde la bandeja, §6.16). */
  activeTarget: UploadTarget | null
  openPanel: (target?: UploadTarget) => void
  closePanel: () => void
  addFiles: (files: File[]) => void
  cancelEntry: (id: string) => void
  /** Reintenta una entrada en error/cancelada — reanuda con GET /status si ya tenía sessionId, en vez de repetir chunks ya confirmados. */
  retryEntry: (id: string) => void
  /** Solo válido sobre entradas terminadas (done/error/cancelled) — quita la fila de la lista. */
  removeEntry: (id: string) => void
}

const UploadQueueContext = createContext<UploadQueueContextValue | null>(null)

/**
 * CLAUDE.md §6.5/§7.4: única vía de subida de todo el proyecto, y segunda
 * excepción documentada a "el único estado global manual es auth" (§3) — se
 * monta una vez en AppShell (nunca dentro del propio modal) precisamente
 * para que una subida siga corriendo aunque se cierre el panel de detalle o
 * se navegue a otra pantalla; un estado local del modal se perdería en
 * cuanto ese componente se desmontase.
 */
export function UploadQueueProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [entries, setEntries] = useState<UploadQueueEntry[]>([])
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [activeTarget, setActiveTarget] = useState<UploadTarget | null>(null)

  // Estado imperativo que no necesita disparar un render por sí mismo.
  const controllersRef = useRef(new Map<string, AbortController>())
  const startedRef = useRef(new Set<string>())

  const patchEntry = useCallback((id: string, patch: Partial<UploadQueueEntry>) => {
    setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
  }, [])

  const setChunkStatus = useCallback((id: string, chunkIndex: number, status: UploadQueueEntry['chunks'][number]) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, chunks: entry.chunks.map((c, i) => (i === chunkIndex ? status : c)) } : entry,
      ),
    )
  }, [])

  const runPipeline = useCallback(
    async (entry: UploadQueueEntry) => {
      const controller = new AbortController()
      controllersRef.current.set(entry.id, controller)
      const plan = computeChunkPlan(entry.file.size)

      try {
        let sessionId = entry.sessionId
        let alreadyReceived: number[] = []

        if (!sessionId) {
          sessionId = await initUploadSession(
            {
              fileName: entry.file.name,
              totalSizeBytes: entry.file.size,
              totalChunks: plan.totalChunks,
              folderId: entry.folderId,
            },
            controller.signal,
          )
          patchEntry(entry.id, {
            sessionId,
            totalChunks: plan.totalChunks,
            chunks: Array<UploadQueueEntry['chunks'][number]>(plan.totalChunks).fill('pending'),
          })
        } else {
          // Reintento (§7.4): reanuda preguntando qué llegó ya en vez de repetirlo.
          alreadyReceived = await getUploadStatus(sessionId, controller.signal)
          patchEntry(entry.id, {
            chunks: Array.from({ length: plan.totalChunks }, (_, i) =>
              alreadyReceived.includes(i + 1) ? 'done' : 'pending',
            ),
          })
        }

        let doneChunkCount = alreadyReceived.length
        for (let chunkNumber = 1; chunkNumber <= plan.totalChunks; chunkNumber++) {
          if (alreadyReceived.includes(chunkNumber)) continue

          setChunkStatus(entry.id, chunkNumber - 1, 'uploading')
          const start = (chunkNumber - 1) * CHUNK_SIZE_BYTES
          const blob = entry.file.slice(start, start + plan.chunkSizes[chunkNumber - 1])

          await uploadChunkWithRetry(sessionId, chunkNumber, blob, controller.signal, (loadedBytes) => {
            patchEntry(entry.id, {
              progress: aggregateProgress(plan.chunkSizes, doneChunkCount, loadedBytes, entry.file.size),
            })
          })

          doneChunkCount += 1
          setChunkStatus(entry.id, chunkNumber - 1, 'done')
          patchEntry(entry.id, {
            progress: aggregateProgress(plan.chunkSizes, doneChunkCount, 0, entry.file.size),
          })
        }

        await completeUploadSession(sessionId, controller.signal)
        patchEntry(entry.id, { status: 'done', progress: 100 })
        void queryClient.invalidateQueries({ queryKey: filesKeys.contents(entry.folderId) })
        void queryClient.invalidateQueries({ queryKey: filesKeys.storageUsage })
      } catch (error) {
        if (controller.signal.aborted) {
          patchEntry(entry.id, { status: 'cancelled' })
        } else {
          const apiError = toApiError(error)
          // errorCode null = nunca llegó una respuesta real del backend (red
          // caída, stall, timeout) — es justo el caso que reintenta solo el
          // efecto de 'online' de abajo. Un código concreto (FileTooLarge,
          // StorageLimitExceeded...) es un rechazo real del servidor: seguirá
          // fallando igual aunque vuelva la conexión, así que no se reintenta
          // solo, se deja para que el usuario decida.
          patchEntry(entry.id, { status: 'error', error: apiError.message, errorCode: apiError.errorCode })
        }
      } finally {
        controllersRef.current.delete(entry.id)
      }
    },
    [patchEntry, queryClient, setChunkStatus],
  )

  // Promueve entradas en cola a "uploading" respetando MAX_CONCURRENT_UPLOADS
  // (CLAUDE.md §7.4) — se dispara solo, cada vez que cambia la cola: al
  // añadir archivos, al cancelar, o al terminar una subida y liberar hueco.
  useEffect(() => {
    const uploadingCount = entries.filter((e) => e.status === 'uploading').length
    const capacity = MAX_CONCURRENT_UPLOADS - uploadingCount
    if (capacity <= 0) return

    const toStart = entries.filter((e) => e.status === 'queued' && !startedRef.current.has(e.id)).slice(0, capacity)
    for (const entry of toStart) {
      startedRef.current.add(entry.id)
      patchEntry(entry.id, { status: 'uploading', progress: 0 })
      void runPipeline(entry)
    }
  }, [entries, patchEntry, runPipeline])

  // Aviso nativo si se cierra/recarga la pestaña con subidas en curso — cerrar
  // el PANEL nunca pierde nada (§6.5), pero cerrar la pestaña del navegador sí
  // (fuera de alcance la reanudación entre recargas, ver CLAUDE.md §7.4).
  useEffect(() => {
    const hasActive = entries.some((e) => e.status === 'queued' || e.status === 'uploading')
    if (!hasActive) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [entries])

  const openPanel = useCallback((target?: UploadTarget) => {
    setActiveTarget(target ?? null)
    setIsPanelOpen(true)
  }, [])

  const closePanel = useCallback(() => setIsPanelOpen(false), [])

  const addFiles = useCallback(
    (files: File[]) => {
      if (!activeTarget) return
      const newEntries: UploadQueueEntry[] = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        folderId: activeTarget.folderId,
        folderName: activeTarget.folderName,
        status: 'queued',
        progress: 0,
        totalChunks: 0,
        chunks: [],
      }))
      setEntries((current) => [...current, ...newEntries])
    },
    [activeTarget],
  )

  const cancelEntry = useCallback(
    (id: string) => {
      const controller = controllersRef.current.get(id)
      if (controller) {
        controller.abort() // el catch de runPipeline marca 'cancelled'
      } else {
        patchEntry(id, { status: 'cancelled' }) // aún en cola, no había arrancado
      }
    },
    [patchEntry],
  )

  const retryEntry = useCallback(
    (id: string) => {
      startedRef.current.delete(id)
      // sessionId se conserva a propósito: si existe, runPipeline reanuda con
      // GET /status en vez de repetir chunks ya confirmados por el servidor.
      patchEntry(id, { status: 'queued', error: undefined, errorCode: undefined })
    },
    [patchEntry],
  )

  const removeEntry = useCallback((id: string) => {
    startedRef.current.delete(id)
    setEntries((current) => current.filter((entry) => entry.id !== id))
  }, [])

  // CLAUDE.md §7.4: al recuperar conexión, reintenta solo las entradas que
  // fallaron por un problema de red (errorCode null — nunca hubo respuesta
  // real del backend). Un rechazo real del servidor (FileTooLarge, etc.) no
  // se arregla solo porque vuelva la conexión, se deja tal cual para que el
  // usuario decida (sigue teniendo el botón "Reintentar" manual).
  useEffect(() => {
    const onOnline = () => {
      for (const entry of entries) {
        if (entry.status === 'error' && entry.errorCode === null) {
          retryEntry(entry.id)
        }
      }
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [entries, retryEntry])

  const value = useMemo<UploadQueueContextValue>(
    () => ({ entries, isPanelOpen, activeTarget, openPanel, closePanel, addFiles, cancelEntry, retryEntry, removeEntry }),
    [entries, isPanelOpen, activeTarget, openPanel, closePanel, addFiles, cancelEntry, retryEntry, removeEntry],
  )

  return <UploadQueueContext.Provider value={value}>{children}</UploadQueueContext.Provider>
}

export function useUploadQueue(): UploadQueueContextValue {
  const context = useContext(UploadQueueContext)
  if (!context) {
    throw new Error('useUploadQueue debe usarse dentro de <UploadQueueProvider>')
  }
  return context
}

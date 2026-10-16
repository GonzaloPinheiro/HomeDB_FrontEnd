import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { toApiError } from '@/shared/api/client'
import { ApiErrorCodes } from '@/shared/api/errors'

import { filesKeys } from '../api'
import { AsyncSemaphore, runWithConcurrency } from './concurrency'
import {
  CHUNK_SIZE_BYTES,
  MAX_CONCURRENT_UPLOADS,
  MAX_PARALLEL_CHUNK_UPLOADS,
  aggregateProgress,
  completeUploadSession,
  computeChunkPlan,
  getUploadStatus,
  initUploadSession,
  uploadChunkWithRetry,
} from './pipeline'
import { RateLimitGate, withRateLimitRetry } from './rateLimit'
import type { ChunkStatus, UploadQueueEntry, UploadTarget } from './types'

type UploadQueueContextValue = {
  entries: UploadQueueEntry[]
  isPanelOpen: boolean
  /**
   * Instante (ms epoch) hasta el que la cola está en pausa por haber agotado el
   * cupo del rate limiter (429), o `null` si no hay pausa. Las subidas se
   * reanudan solas al llegar a ese instante (CLAUDE.md §7.4).
   */
  rateLimitedUntil: number | null
  /** Presente = el panel puede añadir archivos nuevos a esa carpeta; ausente = solo consulta (abierto desde la bandeja, §6.16). */
  activeTarget: UploadTarget | null
  openPanel: (target?: UploadTarget) => void
  closePanel: () => void
  addFiles: (files: File[]) => void
  cancelEntry: (id: string) => void
  /** Reintenta una entrada en error/cancelada — reanuda con GET /status si ya tenía sessionId, en vez de repetir chunks ya confirmados. */
  retryEntry: (id: string) => void
  /** Reintenta todas las entradas en error. Las canceladas no entran: las canceló el usuario a propósito. */
  retryAllFailed: () => void
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
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null)

  // Una única pausa compartida por todas las subidas (rateLimit.ts).
  const [rateLimitGate] = useState(() => new RateLimitGate(Date.now, setRateLimitedUntil))

  // Tope GLOBAL de chunks en vuelo, compartido por todos los archivos de la cola
  // (concurrency.ts). Es lo que hace que MAX_PARALLEL_CHUNK_UPLOADS sea el único
  // mando del paralelismo: da igual cuántos archivos suban a la vez.
  const [chunkSlots] = useState(() => new AsyncSemaphore(MAX_PARALLEL_CHUNK_UPLOADS))

  // Estado imperativo que no necesita disparar un render por sí mismo.
  const controllersRef = useRef(new Map<string, AbortController>())
  const startedRef = useRef(new Set<string>())

  const patchEntry = useCallback((id: string, patch: Partial<UploadQueueEntry>) => {
    setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
  }, [])

  const setChunkStatus = useCallback((id: string, chunkIndex: number, status: ChunkStatus) => {
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
      // Toda petición HTTP del pipeline pasa por aquí: respeta la pausa global y
      // ante un 429 la activa y reintenta sin dar el archivo por fallido. Recibe
      // el signal porque las peticiones de chunk usan el del pool (se aborta si
      // otro chunk del mismo archivo falla), no solo el de cancelación del usuario.
      const limited = <T,>(request: () => Promise<T>, signal: AbortSignal = controller.signal): Promise<T> =>
        withRateLimitRetry(rateLimitGate, signal, request)

      try {
        let alreadyReceived: number[] = []
        // `const` (y no reasignado) para que las closures de abajo conserven el tipo `string`.
        const sessionId: string =
          entry.sessionId ??
          (await limited(() =>
            initUploadSession(
              {
                fileName: entry.file.name,
                totalSizeBytes: entry.file.size,
                totalChunks: plan.totalChunks,
                folderId: entry.folderId,
              },
              controller.signal,
            ),
          ))

        if (!entry.sessionId) {
          patchEntry(entry.id, {
            sessionId,
            totalChunks: plan.totalChunks,
            chunks: Array<UploadQueueEntry['chunks'][number]>(plan.totalChunks).fill('pending'),
          })
        } else {
          // Reintento (§7.4): reanuda preguntando qué llegó ya en vez de repetirlo.
          alreadyReceived = await limited(() => getUploadStatus(sessionId, controller.signal))
          patchEntry(entry.id, {
            chunks: Array.from({ length: plan.totalChunks }, (_, i) =>
              alreadyReceived.includes(i + 1) ? 'done' : 'pending',
            ),
          })
        }

        // Bytes ya enviados de cada chunk (tamaño completo si está confirmado).
        // Con chunks en paralelo cada uno avanza por su cuenta, por eso el
        // progreso se agrega desde este array y no desde un contador secuencial.
        const received = new Set(alreadyReceived)
        const loadedBytes: number[] = plan.chunkSizes.map((size, index) => (received.has(index + 1) ? size : 0))
        const pendingChunks: number[] = []
        for (let chunkNumber = 1; chunkNumber <= plan.totalChunks; chunkNumber++) {
          if (!received.has(chunkNumber)) pendingChunks.push(chunkNumber)
        }

        // axios emite onUploadProgress muy a menudo (y ahora de varios chunks a la
        // vez); cada patchEntry re-renderiza a todos los consumidores del Context
        // (modal, bandeja) y relanza el planificador. El % ya viene redondeado, así
        // que solo se parchea si cambia.
        let lastProgress = -1
        const reportProgress = () => {
          const progress = aggregateProgress(plan.chunkSizes, loadedBytes, entry.file.size)
          if (progress === lastProgress) return
          lastProgress = progress
          patchEntry(entry.id, { progress })
        }
        reportProgress() // al reanudar, muestra de inicio lo que el servidor ya tiene

        // CLAUDE.md §7.4: los chunks pendientes se reparten entre hasta
        // MAX_PARALLEL_CHUNK_UPLOADS workers (con el tope global de chunkSlots). Si
        // uno falla del todo, se aborta el resto y se propaga ese primer error.
        await runWithConcurrency(
          pendingChunks,
          { concurrency: MAX_PARALLEL_CHUNK_UPLOADS, semaphore: chunkSlots, signal: controller.signal },
          async (chunkNumber, chunkSignal) => {
            const index = chunkNumber - 1
            const start = index * CHUNK_SIZE_BYTES
            const blob = entry.file.slice(start, start + plan.chunkSizes[index])

            setChunkStatus(entry.id, index, 'uploading')
            try {
              await limited(() => {
                // Si la petición se repite (tras una pausa por 429) arranca de cero.
                loadedBytes[index] = 0
                return uploadChunkWithRetry(sessionId, chunkNumber, blob, chunkSignal, (chunkLoadedBytes) => {
                  loadedBytes[index] = chunkLoadedBytes
                  reportProgress()
                })
              }, chunkSignal)
            } catch (error) {
              // Con el signal ya abortado el chunk no ha fallado: lo abortó la
              // cancelación del usuario o el fallo de OTRO chunk, y sigue pendiente.
              loadedBytes[index] = 0
              setChunkStatus(entry.id, index, chunkSignal.aborted ? 'pending' : 'error')
              reportProgress()
              throw error
            }

            loadedBytes[index] = plan.chunkSizes[index]
            setChunkStatus(entry.id, index, 'done')
            reportProgress()
          },
        )

        await limited(() => completeUploadSession(sessionId, controller.signal))
        patchEntry(entry.id, { status: 'done', progress: 100 })
        void queryClient.invalidateQueries({ queryKey: filesKeys.contents(entry.folderId) })
        void queryClient.invalidateQueries({ queryKey: filesKeys.storageUsage })
      } catch (error) {
        if (controller.signal.aborted) {
          patchEntry(entry.id, { status: 'cancelled' })
        } else {
          // Los fragmentos en vuelo ya se resolvieron en su tarea (error / pendiente),
          // así que ninguno se queda "subiendo" (pulsando) para siempre en la tira de §6.4.
          const apiError = toApiError(error)
          // errorCode null = nunca llegó una respuesta real del backend (red
          // caída, stall, timeout) — es justo el caso que reintenta solo el
          // efecto de 'online' de abajo. Un código concreto (FileTooLarge,
          // StorageLimitExceeded...) es un rechazo real del servidor: seguirá
          // fallando igual aunque vuelva la conexión, así que no se reintenta
          // solo, se deja para que el usuario decida.
          // Sesión muerta en el servidor (cancelada, p. ej. porque falló el
          // ensamblado en `complete`, o inexistente): reanudarla con GET /status
          // nunca funcionaría, así que se descarta el sessionId y el próximo
          // reintento empieza una subida nueva en vez de fallar siempre igual.
          const isDeadSession =
            apiError.errorCode === ApiErrorCodes.UploadSessionNotActive ||
            apiError.errorCode === ApiErrorCodes.UploadSessionNotFound
          patchEntry(entry.id, {
            status: 'error',
            error: apiError.message,
            errorCode: apiError.errorCode,
            ...(isDeadSession ? { sessionId: undefined, totalChunks: 0, chunks: [], progress: 0 } : {}),
          })
        }
      } finally {
        controllersRef.current.delete(entry.id)
      }
    },
    [chunkSlots, patchEntry, queryClient, rateLimitGate, setChunkStatus],
  )

  // Limpia el aviso de pausa al llegar su instante. Comparar contra el valor
  // capturado evita borrar una pausa más larga que se activara mientras tanto.
  useEffect(() => {
    if (rateLimitedUntil === null) return
    const timer = setTimeout(
      () => setRateLimitedUntil((current) => (current === rateLimitedUntil ? null : current)),
      Math.max(0, rateLimitedUntil - Date.now()),
    )
    return () => clearTimeout(timer)
  }, [rateLimitedUntil])

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

  const retryAllFailed = useCallback(() => {
    const failedIds = new Set(entries.filter((e) => e.status === 'error').map((e) => e.id))
    if (failedIds.size === 0) return
    for (const id of failedIds) startedRef.current.delete(id)
    // Mismas reglas que retryEntry (conserva sessionId para reanudar con GET /status),
    // en una sola actualización de estado en vez de N. El planificador de arriba
    // las va promoviendo a 'uploading' de MAX_CONCURRENT_UPLOADS en MAX_CONCURRENT_UPLOADS.
    setEntries((current) =>
      current.map((entry) =>
        failedIds.has(entry.id) ? { ...entry, status: 'queued', error: undefined, errorCode: undefined } : entry,
      ),
    )
  }, [entries])

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
    () => ({
      entries,
      isPanelOpen,
      rateLimitedUntil,
      activeTarget,
      openPanel,
      closePanel,
      addFiles,
      cancelEntry,
      retryEntry,
      retryAllFailed,
      removeEntry,
    }),
    [
      entries,
      isPanelOpen,
      rateLimitedUntil,
      activeTarget,
      openPanel,
      closePanel,
      addFiles,
      cancelEntry,
      retryEntry,
      retryAllFailed,
      removeEntry,
    ],
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

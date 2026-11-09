import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { toApiError } from '@/shared/api/client'
import { ApiErrorCodes } from '@/shared/api/errors'
import type { DroppedItems } from '@/shared/lib/fileDrop'

import { createFolderRequest, filesKeys, listSubfoldersRequest } from '../api'
import {
  ProcessingTimeoutError,
  UploadSessionEndedError,
  processingTimeoutMs,
  waitForUploadCompletion,
} from './completion'
import { AsyncSemaphore, runWithConcurrency } from './concurrency'
import {
  MAX_FOLDER_SCAN_FILES,
  readDirectoryTrees,
  treeFilesFromRelativePaths,
  type ScanResult,
  type TreeFile,
} from './directoryTree'
import { UNCERTAIN_OUTCOME_MESSAGE, isOutcomeUncertain, uploadKindOf } from './directUpload'
import { summarizeEntries } from './entryList'
import { FolderResolver } from './folderResolver'
import { InvalidationBatcher } from './invalidationBatcher'
import {
  CHUNK_SIZE_BYTES,
  MAX_CONCURRENT_CHUNKED_UPLOADS,
  MAX_CONCURRENT_DIRECT_UPLOADS,
  MAX_PARALLEL_CHUNK_UPLOADS,
  aggregateProgress,
  completeUploadSession,
  computeChunkPlan,
  getUploadStatus,
  initUploadSession,
  loadedBytesTotal,
  uploadChunkWithRetry,
  uploadFileDirect,
} from './pipeline'
import { RateLimitGate, withRateLimitRetry } from './rateLimit'
import { pickEntriesToStart } from './scheduler'
import { SpeedTracker } from './speed'
import {
  describeSkippedFiles,
  planTreeUpload,
  scanLimitMessage,
  unreadableMessage,
} from './treeUpload'
import type { ChunkStatus, UploadQueueEntry, UploadTarget } from './types'

// CLAUDE.md §7.4: el Context se parte en DOS, y esa partición es la decisión de
// rendimiento: el estado cambia en cada tick de progreso de cualquier archivo, las
// acciones no cambian nunca. Con un único Context, cada tick re-renderizaba a todo
// consumidor — incluido el explorador de archivos entero (lista incluida), que solo
// necesita `openPanel`/`addDropped`. Quien solo ACTÚA usa `useUploadQueueActions`;
// quien PINTA la cola usa `useUploadQueueState`.
type UploadQueueState = {
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
}

/** Referencialmente estable durante toda la vida del Provider (ver el comentario de arriba). */
type UploadQueueActions = {
  openPanel: (target?: UploadTarget) => void
  closePanel: () => void
  /**
   * Encola archivos hacia `target`, o hacia el destino activo del panel si se omite
   * (el panel solo lo tiene abierto desde "Subir"). Devuelve cuántos se encolaron:
   * los de extensión no admitida se rechazan aquí con un aviso (allowedExtensions.ts).
   */
  addFiles: (files: File[], target?: UploadTarget) => number
  /**
   * Encola lo soltado o pegado, carpetas incluidas (§7.4): primero se lee su
   * contenido (asíncrono) y luego sube cada archivo a la carpeta que le toca bajo
   * `target`, creándola o reutilizando la que ya exista con ese nombre. Devuelve
   * cuántos archivos se encolaron (0 si no había nada que subir o era demasiado).
   */
  addDropped: (dropped: DroppedItems, target?: UploadTarget) => Promise<number>
  /**
   * Igual para los archivos de una carpeta elegida con `<input webkitdirectory>`:
   * la ruta de cada uno viene en `webkitRelativePath`. Devuelve cuántos se encolaron.
   */
  addFolderFiles: (files: File[], target?: UploadTarget) => number
  cancelEntry: (id: string) => void
  /** Reintenta una entrada en error/cancelada — reanuda con GET /status si ya tenía sessionId, en vez de repetir chunks ya confirmados. */
  retryEntry: (id: string) => void
  /** Reintenta todas las entradas en error. Las canceladas no entran: las canceló el usuario a propósito. */
  retryAllFailed: () => void
  /** Solo válido sobre entradas terminadas (done/error/cancelled) — quita la fila de la lista. */
  removeEntry: (id: string) => void
}

const UploadQueueStateContext = createContext<UploadQueueState | null>(null)
const UploadQueueActionsContext = createContext<UploadQueueActions | null>(null)

// Señal que nunca se aborta, para las peticiones de crear/consultar carpetas: ese
// trabajo lo comparten todos los archivos que necesitan la carpeta (folderResolver.ts),
// así que no debe cancelarse porque se cancele UNO de ellos.
const NEVER_ABORTED: AbortSignal = new AbortController().signal

// Un árbol grande tarda en leerse (cada archivo es una consulta al navegador): el
// aviso solo aparece si pasa de este tiempo, para no parpadear con carpetas pequeñas.
const SCAN_FEEDBACK_DELAY_MS = 400

async function scanWithFeedback(directories: DroppedItems['directories']): Promise<ScanResult> {
  let toastId: string | number | undefined
  const timer = setTimeout(() => {
    toastId = toast.loading('Leyendo la carpeta…')
  }, SCAN_FEEDBACK_DELAY_MS)
  try {
    return await readDirectoryTrees(directories)
  } finally {
    clearTimeout(timer)
    if (toastId !== undefined) toast.dismiss(toastId)
  }
}

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

  // Agrupa las invalidaciones de caché de los archivos que terminan (§7.4,
  // invalidationBatcher.ts): sin esto, cada archivo gasta 2 peticiones extra de refresco.
  const [invalidationBatcher] = useState(
    () =>
      new InvalidationBatcher(({ folderIds, storageUsage }) => {
        for (const folderId of folderIds) {
          void queryClient.invalidateQueries({ queryKey: filesKeys.contents(folderId) })
        }
        if (storageUsage) void queryClient.invalidateQueries({ queryKey: filesKeys.storageUsage })
      }),
  )

  // Crea o reutiliza las carpetas de destino de las subidas de carpeta (§7.4). Sus
  // peticiones pasan por la misma pausa de rate limit que el resto de la cola.
  const [folderResolver] = useState(
    () =>
      new FolderResolver(
        {
          listSubfolders: (parentId) =>
            withRateLimitRetry(rateLimitGate, NEVER_ABORTED, () => listSubfoldersRequest(parentId)),
          createFolder: async (name, parentId) => {
            const folder = await withRateLimitRetry(rateLimitGate, NEVER_ABORTED, () =>
              createFolderRequest(name, parentId),
            )
            return folder.id
          },
        },
        // Para que la carpeta nueva aparezca ya en la lista de su padre si se está viendo.
        (parentId) => invalidationBatcher.markChanged(parentId),
      ),
  )

  // Estado imperativo que no necesita disparar un render por sí mismo.
  const controllersRef = useRef(new Map<string, AbortController>())
  const startedRef = useRef(new Set<string>())
  // Entradas esperando el resultado del ensamblado en background (id -> tamaño del
  // archivo), en orden de llegada: da el nº de esperas simultáneas (cadencia de
  // consultas) y lo que tenía delante cada una (plazo de espera) — completion.ts.
  const processingBytesRef = useRef(new Map<string, number>())
  // Espejos de lo que las acciones necesitan LEER sin depender de ello: si leyeran el
  // estado, dejarían de ser estables y el Context de acciones no serviría de nada.
  const entriesRef = useRef<UploadQueueEntry[]>([])
  const activeTargetRef = useRef<UploadTarget | null>(null)

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
      // Directa (una petición) o por sesión (chunks): depende solo del tamaño (directUpload.ts).
      const kind = uploadKindOf(entry.file.size)
      // Toda petición HTTP del pipeline pasa por aquí: respeta la pausa global y
      // ante un 429 la activa y reintenta sin dar el archivo por fallido. Recibe
      // el signal porque las peticiones de chunk usan el del pool (se aborta si
      // otro chunk del mismo archivo falla), no solo el de cancelación del usuario.
      const limited = <T,>(request: () => Promise<T>, signal: AbortSignal = controller.signal): Promise<T> =>
        withRateLimitRetry(rateLimitGate, signal, request)

      // Envía los chunks que el servidor aún no tiene (todos en una subida nueva).
      const sendMissingChunks = async (sessionId: string, alreadyReceived: number[]) => {
        patchEntry(entry.id, {
          chunks: Array.from({ length: plan.totalChunks }, (_, i) =>
            alreadyReceived.includes(i + 1) ? 'done' : 'pending',
          ),
        })

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
        const speedTracker = new SpeedTracker()
        const reportProgress = () => {
          speedTracker.record(Date.now(), loadedBytesTotal(plan.chunkSizes, loadedBytes))
          const progress = aggregateProgress(plan.chunkSizes, loadedBytes, entry.file.size)
          if (progress === lastProgress) return
          lastProgress = progress
          patchEntry(entry.id, { progress })
        }
        reportProgress() // al reanudar, muestra de inicio lo que el servidor ya tiene

        // La velocidad se refresca por reloj y no por evento de progreso: si la subida
        // se atasca no llegan eventos y el valor se quedaría congelado (speed.ts la hace caer).
        const speedTimer = setInterval(() => {
          patchEntry(entry.id, {
            uploadedBytes: loadedBytesTotal(plan.chunkSizes, loadedBytes),
            speedBytesPerSec: speedTracker.bytesPerSecond(Date.now()),
          })
        }, 1000)

        try {
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
        } finally {
          clearInterval(speedTimer)
        }
      }

      // Carpeta en la que va el archivo. Es `entry.folderId` salvo en la subida de una
      // carpeta (§7.4): ahí hay que crear (o reutilizar) las carpetas de `subPath` y
      // se hace aquí, dentro del hueco de subida del propio archivo, para que un
      // fallo al crearlas sea un error de ESTA fila con su "Reintentar" y se pueda
      // cancelar como cualquier otro paso.
      const resolveDestination = async (): Promise<number | null> => {
        if (!entry.subPath || entry.subPath.length === 0) return entry.folderId
        if (entry.resolvedFolderId !== undefined) return entry.resolvedFolderId
        const resolved = await folderResolver.resolve(entry.folderId, entry.subPath, controller.signal)
        patchEntry(entry.id, { resolvedFolderId: resolved })
        return resolved
      }

      // Subida por sesión, para los archivos de más de un chunk (§7.4): init → chunks →
      // complete → espera del ensamblado en background.
      const uploadInChunks = async (destinationFolderId: number | null): Promise<void> => {
        // Reintento (§7.4): si la entrada ya tenía sesión, el servidor dice en qué
        // punto quedó (faltan chunks / ya ensamblando / ya terminada) en vez de
        // repetir nada a ciegas. `const` para que las closures conserven el tipo `string`.
        const existingSessionId = entry.sessionId
        const resumedStatus = existingSessionId
          ? await limited(() => getUploadStatus(existingSessionId, controller.signal))
          : null

        if (resumedStatus?.status === 'cancelled') throw new UploadSessionEndedError(resumedStatus.errorCode)

        const sessionId: string =
          existingSessionId ??
          (await limited(() =>
            initUploadSession(
              {
                fileName: entry.file.name,
                totalSizeBytes: entry.file.size,
                totalChunks: plan.totalChunks,
                folderId: destinationFolderId,
              },
              controller.signal,
            ),
          ))
        if (!existingSessionId) patchEntry(entry.id, { sessionId, totalChunks: plan.totalChunks })

        // La sesión puede estar ya en 'processing' (se reintenta tras perder la
        // respuesta de `complete`, o tras un fallo de red mientras se esperaba) o
        // incluso 'completed': entonces no queda nada que subir ni que encolar.
        if (resumedStatus?.status !== 'processing' && resumedStatus?.status !== 'completed') {
          await sendMissingChunks(sessionId, resumedStatus?.receivedChunks ?? [])
          // Solo ENCOLA el ensamblado y responde 202 (pipeline.ts) — ya no hay que
          // esperarlo con la petición abierta.
          await limited(() => completeUploadSession(sessionId, controller.signal))
        }

        if (resumedStatus?.status !== 'completed') {
          // Todo está en el servidor: la entrada deja de ocupar hueco de subida
          // (el planificador arranca la siguiente) y pasa a esperar el resultado.
          const backlogBytes = [...processingBytesRef.current.values()].reduce((sum, bytes) => sum + bytes, 0)
          processingBytesRef.current.set(entry.id, entry.file.size)
          patchEntry(entry.id, {
            status: 'processing',
            progress: 100,
            uploadedBytes: entry.file.size,
            speedBytesPerSec: null,
            totalChunks: plan.totalChunks,
            chunks: Array<UploadQueueEntry['chunks'][number]>(plan.totalChunks).fill('done'),
          })

          await waitForUploadCompletion({
            fetchStatus: () => limited(() => getUploadStatus(sessionId, controller.signal)),
            signal: controller.signal,
            timeoutMs: processingTimeoutMs(entry.file.size, backlogBytes),
            waitingEntries: () => processingBytesRef.current.size,
          })
        }
      }

      // Subida directa, para los archivos que caben en un chunk (§7.4, directUpload.ts):
      // UNA petición, sin sesión, y la respuesta ya trae el archivo creado, así que no
      // hay estado `processing` ni consultas. NO se reintenta sola (no es idempotente):
      // solo la repite `limited` ante un 429, que el backend rechaza antes de crear nada.
      const uploadDirectly = async (destinationFolderId: number | null): Promise<void> => {
        const size = entry.file.size
        let sentBytes = 0 // de la única petición; 0 si arranca de cero tras una pausa por 429
        let lastProgress = -1
        const speedTracker = new SpeedTracker()
        const reportProgress = () => {
          speedTracker.record(Date.now(), loadedBytesTotal([size], [sentBytes]))
          // Tope 99: con el cuerpo ya enviado el servidor aún guarda y valida el archivo;
          // el 100 % llega con su respuesta, no antes.
          const progress = Math.min(99, aggregateProgress([size], [sentBytes], size))
          if (progress === lastProgress) return
          lastProgress = progress
          patchEntry(entry.id, { progress })
        }
        // Igual que en sendMissingChunks: por reloj, para que la velocidad caiga si se atasca.
        const speedTimer = setInterval(() => {
          patchEntry(entry.id, {
            uploadedBytes: loadedBytesTotal([size], [sentBytes]),
            speedBytesPerSec: speedTracker.bytesPerSecond(Date.now()),
          })
        }, 1000)

        try {
          // Ocupa un hueco del semáforo global como un chunk, para que
          // MAX_PARALLEL_CHUNK_UPLOADS siga siendo el único mando de cuántas peticiones de
          // carga viajan a la vez. Es el mismo pool con una sola tarea: reutiliza su
          // cancelación y su orden de turnos en vez de reimplementarlos.
          await runWithConcurrency(
            [entry.file],
            { concurrency: 1, semaphore: chunkSlots, signal: controller.signal },
            async (file, requestSignal) => {
              await limited(() => {
                sentBytes = 0
                return uploadFileDirect({ file, folderId: destinationFolderId }, requestSignal, (loaded) => {
                  sentBytes = loaded
                  reportProgress()
                })
              }, requestSignal)
            },
          )
        } finally {
          clearInterval(speedTimer)
        }
      }

      try {
        const destinationFolderId = await resolveDestination()

        if (kind === 'direct') await uploadDirectly(destinationFolderId)
        else await uploadInChunks(destinationFolderId)

        patchEntry(entry.id, { status: 'done', progress: 100, uploadedBytes: entry.file.size, speedBytesPerSec: null })
        invalidationBatcher.markChanged(destinationFolderId, { storageUsage: true })
      } catch (error) {
        if (controller.signal.aborted) {
          patchEntry(entry.id, { status: 'cancelled', speedBytesPerSec: null })
        } else if (error instanceof ProcessingTimeoutError) {
          // Sin código de la API y sin ser un fallo de red: no se reintenta solo
          // (types.ts). La sesión se conserva: "Reintentar" vuelve a mirar su estado.
          patchEntry(entry.id, {
            status: 'error',
            speedBytesPerSec: null,
            error: error.message,
            errorCode: undefined,
          })
        } else if (kind === 'direct' && isOutcomeUncertain(toApiError(error))) {
          // Subida directa sin respuesta fiable (red, stall, 5xx): el archivo PUDO crearse,
          // y repetirla a ciegas lo duplicaría (directUpload.ts). Por eso `errorCode` es
          // `undefined` y no `null`: el reintento automático al volver la conexión solo
          // recoge los `null`. El usuario decide con el botón "Reintentar", ya avisado.
          patchEntry(entry.id, {
            status: 'error',
            speedBytesPerSec: null,
            error: UNCERTAIN_OUTCOME_MESSAGE,
            errorCode: undefined,
          })
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
          // Sesión muerta en el servidor (cancelada —p. ej. porque falló el
          // ensamblado en background—, o inexistente): reanudarla con GET /status
          // nunca funcionaría, así que se descarta el sessionId y el próximo
          // reintento empieza una subida nueva en vez de fallar siempre igual.
          const isDeadSession =
            error instanceof UploadSessionEndedError ||
            apiError.errorCode === ApiErrorCodes.UploadSessionNotActive ||
            apiError.errorCode === ApiErrorCodes.UploadSessionNotFound
          // Subida de carpeta cuyo destino ya no existe (el usuario lo borró mientras
          // tanto): ni el id guardado en la fila ni lo que recuerda el resolvedor
          // valen ya, y "Reintentar" tiene que volver a resolver la ruta desde cero
          // en vez de fallar siempre con el mismo id.
          const isStaleDestination =
            entry.subPath !== undefined && apiError.errorCode === ApiErrorCodes.FolderNotFound
          if (isStaleDestination) folderResolver.clear()
          patchEntry(entry.id, {
            status: 'error',
            speedBytesPerSec: null,
            error: apiError.message,
            errorCode: apiError.errorCode,
            ...(isDeadSession
              ? { sessionId: undefined, totalChunks: 0, chunks: [], progress: 0, uploadedBytes: 0 }
              : {}),
            ...(isStaleDestination ? { resolvedFolderId: undefined } : {}),
          })
        }
      } finally {
        processingBytesRef.current.delete(entry.id)
        controllersRef.current.delete(entry.id)
      }
    },
    [chunkSlots, folderResolver, invalidationBatcher, patchEntry, rateLimitGate, setChunkStatus],
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

  // Promueve entradas en cola a "uploading" (CLAUDE.md §7.4, scheduler.ts) — se dispara
  // solo, cada vez que cambia la cola: al añadir archivos, al cancelar, o al terminar una
  // subida y liberar hueco. Hay un tope por tipo de subida (grandes por sesión / pequeñas
  // directas), no uno global.
  useEffect(() => {
    const toStart = pickEntriesToStart(entries, startedRef.current, {
      chunked: MAX_CONCURRENT_CHUNKED_UPLOADS,
      direct: MAX_CONCURRENT_DIRECT_UPLOADS,
    })
    for (const entry of toStart) {
      startedRef.current.add(entry.id)
      patchEntry(entry.id, { status: 'uploading', progress: 0 })
      void runPipeline(entry)
    }
  }, [entries, patchEntry, runPipeline])

  // Los efectos de abajo solo necesitan saber SI hay actividad, no cada cambio de la
  // lista: con un booleano como dependencia se ejecutan al cambiar de estado la cola,
  // no en cada tick de progreso (antes el aviso de cierre se quitaba y volvía a poner
  // en cada uno).
  const summary = useMemo(() => summarizeEntries(entries), [entries])
  const hasQueuedOrUploading = summary.queued + summary.uploading > 0
  // 'processing' cuenta aquí: su archivo aún no existe en el servidor (§7.4).
  const isBusy = hasQueuedOrUploading || summary.processing > 0

  // El resolvedor de carpetas recuerda qué carpetas existen mientras hay subidas en
  // marcha (para no crear una dos veces ni preguntar por ella en cada archivo). Con
  // la cola ya inactiva ese recuerdo puede estar desfasado —el usuario borra o crea
  // carpetas—, así que se olvida y un "Reintentar" posterior vuelve a consultar.
  useEffect(() => {
    if (!hasQueuedOrUploading) folderResolver.clear()
  }, [hasQueuedOrUploading, folderResolver])

  // Cola inactiva: lo último que se subió debe verse YA, sin esperar al cierre de la
  // ventana de invalidaciones (invalidationBatcher.ts). Sin nada pendiente no hace nada.
  useEffect(() => {
    if (!isBusy) invalidationBatcher.flushNow()
  }, [isBusy, invalidationBatcher])

  // Al desmontar el Provider (cierre de sesión) no debe quedar ningún temporizador vivo.
  useEffect(() => () => invalidationBatcher.dispose(), [invalidationBatcher])

  // Aviso nativo si se cierra/recarga la pestaña con subidas en curso — cerrar
  // el PANEL nunca pierde nada (§6.5), pero cerrar la pestaña del navegador sí
  // (fuera de alcance la reanudación entre recargas, ver CLAUDE.md §7.4).
  // 'processing' queda fuera a propósito: con todos los chunks ya en el servidor,
  // el worker en background termina el archivo aunque se cierre la pestaña.
  useEffect(() => {
    if (!hasQueuedOrUploading) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasQueuedOrUploading])

  // Espejo de `entries` para las acciones (ver `entriesRef`). Se actualiza en un efecto
  // y no durante el render, que es donde React no admite escribir en una ref.
  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  const openPanel = useCallback((target?: UploadTarget) => {
    // Único sitio que cambia el destino activo: el espejo se escribe aquí, a la vez que
    // el estado, para que un `addFiles` inmediato ya lo vea (addFiles lee la ref).
    activeTargetRef.current = target ?? null
    setActiveTarget(target ?? null)
    setIsPanelOpen(true)
  }, [])

  const closePanel = useCallback(() => setIsPanelOpen(false), [])

  // Único camino por el que algo entra en la cola: archivos sueltos (`dirs` vacío) y
  // archivos de una carpeta, para que las reglas de qué se encola no puedan divergir.
  const enqueueTree = useCallback((items: TreeFile[], target: UploadTarget): number => {
    // CLAUDE.md §5.4: el backend solo valida la extensión al final de la subida (al
    // ensamblar, en background), y rechaza los archivos de 0 bytes en `init`; se
    // descartan aquí para no subir un archivo grande entero y perderlo al final.
    const plan = planTreeUpload(items)

    for (const message of describeSkippedFiles(plan)) toast.error(message)
    if (plan.accepted.length === 0) return 0

    const newEntries: UploadQueueEntry[] = plan.accepted.map(({ file, dirs }) => ({
      id: crypto.randomUUID(),
      file,
      folderId: target.folderId,
      folderName: dirs.length > 0 ? [target.folderName, ...dirs].join('/') : target.folderName,
      ...(dirs.length > 0 ? { subPath: dirs } : {}),
      status: 'queued',
      progress: 0,
      uploadedBytes: 0,
      speedBytesPerSec: null,
      totalChunks: 0,
      chunks: [],
    }))
    setEntries((current) => [...current, ...newEntries])
    return newEntries.length
  }, [])

  const addFiles = useCallback(
    (files: File[], target: UploadTarget | null = activeTargetRef.current): number => {
      if (!target) return 0
      return enqueueTree(
        files.map((file) => ({ file, dirs: [] })),
        target,
      )
    },
    [enqueueTree],
  )

  const addFolderFiles = useCallback(
    (files: File[], target: UploadTarget | null = activeTargetRef.current): number => {
      if (!target) return 0
      if (files.length > MAX_FOLDER_SCAN_FILES) {
        toast.error(scanLimitMessage())
        return 0
      }
      return enqueueTree(treeFilesFromRelativePaths(files), target)
    },
    [enqueueTree],
  )

  const addDropped = useCallback(
    async (dropped: DroppedItems, target: UploadTarget | null = activeTargetRef.current): Promise<number> => {
      if (!target) return 0
      if (dropped.directories.length === 0) return addFiles(dropped.files, target)

      const scan = await scanWithFeedback(dropped.directories)
      // Las carpetas se descartan enteras (una lectura a medias subiría un árbol
      // incompleto sin avisar), pero los archivos sueltos soltados con ellas no
      // dependen de eso y se suben igualmente.
      if (scan.exceededScanLimit) {
        toast.error(scanLimitMessage())
        return addFiles(dropped.files, target)
      }
      if (scan.unreadable > 0) toast.error(unreadableMessage(scan.unreadable))
      if (scan.files.length === 0 && scan.unreadable === 0 && dropped.files.length === 0) {
        toast('La carpeta no tiene archivos que subir (las carpetas vacías no se crean)')
        return 0
      }

      return enqueueTree([...dropped.files.map((file) => ({ file, dirs: [] })), ...scan.files], target)
    },
    [addFiles, enqueueTree],
  )

  const cancelEntry = useCallback(
    (id: string) => {
      // Una entrada en 'processing' ya no se puede cancelar: todos los chunks
      // están en el servidor y su worker en background terminará el archivo
      // igualmente (no hay endpoint para pararlo, §5.4). Marcarla 'cancelada'
      // mentiría: el archivo acabaría apareciendo en la carpeta. `processingBytesRef`
      // contiene exactamente las entradas en ese estado (runPipeline las añade al
      // pasar a 'processing' y las quita al terminar), y no obliga a leer `entries`.
      if (processingBytesRef.current.has(id)) return
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
    const failedIds = new Set(entriesRef.current.filter((e) => e.status === 'error').map((e) => e.id))
    if (failedIds.size === 0) return
    for (const id of failedIds) startedRef.current.delete(id)
    // Mismas reglas que retryEntry (conserva sessionId para reanudar con GET /status),
    // en una sola actualización de estado en vez de N. El planificador de arriba
    // las va promoviendo a 'uploading' (scheduler.ts) respetando el tope de cada tipo de subida.
    setEntries((current) =>
      current.map((entry) =>
        failedIds.has(entry.id) ? { ...entry, status: 'queued', error: undefined, errorCode: undefined } : entry,
      ),
    )
  }, [])

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
      for (const entry of entriesRef.current) {
        if (entry.status === 'error' && entry.errorCode === null) {
          retryEntry(entry.id)
        }
      }
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [retryEntry])

  const state = useMemo<UploadQueueState>(
    () => ({ entries, isPanelOpen, rateLimitedUntil, activeTarget }),
    [entries, isPanelOpen, rateLimitedUntil, activeTarget],
  )

  // Todas las acciones son estables (no leen estado, solo refs y setters), así que este
  // valor se crea una vez: es lo que evita re-renders al consumirlo (ver arriba).
  const actions = useMemo<UploadQueueActions>(
    () => ({
      openPanel,
      closePanel,
      addFiles,
      addDropped,
      addFolderFiles,
      cancelEntry,
      retryEntry,
      retryAllFailed,
      removeEntry,
    }),
    [openPanel, closePanel, addFiles, addDropped, addFolderFiles, cancelEntry, retryEntry, retryAllFailed, removeEntry],
  )

  return (
    <UploadQueueActionsContext.Provider value={actions}>
      <UploadQueueStateContext.Provider value={state}>{children}</UploadQueueStateContext.Provider>
    </UploadQueueActionsContext.Provider>
  )
}

/** Estado de la cola — cambia en cada tick de progreso: úsalo solo donde se PINTA la cola (panel, bandeja). */
export function useUploadQueueState(): UploadQueueState {
  const context = useContext(UploadQueueStateContext)
  if (!context) {
    throw new Error('useUploadQueueState debe usarse dentro de <UploadQueueProvider>')
  }
  return context
}

/** Acciones de la cola — referencialmente estables: usarlas no re-renderiza al consumidor cuando avanza una subida. */
export function useUploadQueueActions(): UploadQueueActions {
  const context = useContext(UploadQueueActionsContext)
  if (!context) {
    throw new Error('useUploadQueueActions debe usarse dentro de <UploadQueueProvider>')
  }
  return context
}

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { toApiError } from '@/shared/api/client'
import { ApiErrorCodes, getErrorMessage } from '@/shared/api/errors'

import { filesKeys } from '../api'
import {
  ProcessingTimeoutError,
  UploadSessionEndedError,
  processingTimeoutMs,
  waitForUploadCompletion,
} from './completion'
import { getUploadStatus } from './pipeline'
import { withRateLimitRetry, type RateLimitGate } from './rateLimit'
import {
  findResumable,
  type ResumableQuery,
  type ResumableStore,
  type ResumableUpload,
} from './resumableUploads'

/** Una subida que el servidor tiene a medias y que se puede continuar si el usuario vuelve a dar el archivo. */
export type InterruptedUpload = ResumableUpload & {
  /** Chunks que el servidor ya tiene (de `totalChunks`). */
  receivedChunks: number
}

type InterruptedUploads = {
  /** Subidas a medias de una visita anterior, confirmadas con el servidor. */
  interrupted: InterruptedUpload[]
  /** Olvida una (no hay endpoint para cancelarla en el servidor, §5.4: la sesión queda huérfana allí). */
  discard: (sessionId: string) => void
  /**
   * Reclama el registro que coincide con este archivo y destino para reanudarlo
   * (§7.4), o `undefined`. Cada registro se entrega UNA sola vez: dos copias del
   * mismo archivo no pueden compartir sesión.
   */
  claim: (query: ResumableQuery) => ResumableUpload | undefined
}

/**
 * CLAUDE.md §7.4: al abrir la app, comprueba con el servidor qué ha sido de cada
 * subida que quedó registrada (`ResumableStore`) y la clasifica:
 *  - sigue a medias (`inProgress`) → "subida interrumpida", reanudable;
 *  - el servidor la está ensamblando (`processing`) → se espera su final en
 *    segundo plano, sin necesitar el archivo (todo está ya en el servidor);
 *  - terminó (`completed`) o murió (`cancelled`, o ya no existe) → se limpia el
 *    registro y, si procede, se avisa.
 * Un fallo de red al comprobar NO borra nada: se vuelve a mirar en la próxima carga.
 */
export function useInterruptedUploads(
  store: ResumableStore | null,
  gate: RateLimitGate,
): InterruptedUploads {
  const queryClient = useQueryClient()
  const [interrupted, setInterrupted] = useState<InterruptedUpload[]>([])
  const claimedRef = useRef(new Set<string>())

  useEffect(() => {
    if (!store) return
    // Se aborta al desmontar. En desarrollo StrictMode monta, desmonta y vuelve a
    // montar: la primera pasada queda cancelada y la segunda hace el trabajo entero,
    // por eso no hay ningún "ya verificado" que la segunda pudiera saltarse.
    const controller = new AbortController()
    const { signal } = controller
    let watching = 0

    const fetchStatus = (sessionId: string) =>
      withRateLimitRetry(gate, signal, () => getUploadStatus(sessionId, signal))

    // El archivo pudo aparecer (o cambiar el espacio ocupado) mientras no estábamos.
    const refreshFolder = (record: ResumableUpload) => {
      void queryClient.invalidateQueries({ queryKey: filesKeys.contents(record.folderId) })
      void queryClient.invalidateQueries({ queryKey: filesKeys.storageUsage })
    }

    const watchProcessing = async (record: ResumableUpload): Promise<void> => {
      watching += 1
      try {
        await waitForUploadCompletion({
          fetchStatus: () => fetchStatus(record.sessionId),
          signal,
          timeoutMs: processingTimeoutMs(record.size, 0),
          waitingEntries: () => watching,
        })
        store.remove(record.sessionId)
        refreshFolder(record)
        toast.success(`"${record.fileName}" ya está subido`)
      } catch (error) {
        if (signal.aborted) return
        if (error instanceof UploadSessionEndedError || error instanceof ProcessingTimeoutError) {
          store.remove(record.sessionId)
          toast.error(`No se pudo terminar de subir "${record.fileName}": ${error.message}`)
        } else if (toApiError(error).errorCode === ApiErrorCodes.UploadSessionNotFound) {
          store.remove(record.sessionId) // la limpieza nocturna del backend ya la retiró
          refreshFolder(record)
        }
        // Cualquier otro (sin red...): el registro se queda y se vuelve a mirar en la próxima carga.
      } finally {
        watching -= 1
      }
    }

    const verify = async (): Promise<void> => {
      for (const record of store.list()) {
        if (signal.aborted) return
        if (claimedRef.current.has(record.sessionId)) continue
        try {
          const status = await fetchStatus(record.sessionId)
          // Pudo reclamarla una subida nueva mientras esperábamos la respuesta.
          if (signal.aborted || claimedRef.current.has(record.sessionId)) continue

          if (status.status === 'inProgress') {
            if (record.phase !== 'uploading') store.setPhase(record.sessionId, 'uploading')
            const entry: InterruptedUpload = {
              ...record,
              phase: 'uploading',
              receivedChunks: status.receivedChunks.length,
            }
            setInterrupted((current) => [
              ...current.filter((c) => c.sessionId !== record.sessionId),
              entry,
            ])
          } else if (status.status === 'processing') {
            void watchProcessing(record)
          } else if (status.status === 'completed') {
            store.remove(record.sessionId)
            refreshFolder(record)
            toast.success(`"${record.fileName}" ya está subido`)
          } else {
            store.remove(record.sessionId)
            toast.error(
              `No se pudo terminar de subir "${record.fileName}": ${getErrorMessage(status.errorCode ?? ApiErrorCodes.UploadSessionNotActive)}`,
            )
          }
        } catch (error) {
          if (signal.aborted) return
          if (toApiError(error).errorCode === ApiErrorCodes.UploadSessionNotFound) {
            store.remove(record.sessionId)
            refreshFolder(record)
          }
          // Cualquier otro (sin red...): se deja el registro y se mira en la próxima carga.
        }
      }
    }

    void verify()
    return () => controller.abort()
  }, [store, gate, queryClient])

  const discard = useCallback(
    (sessionId: string) => {
      store?.remove(sessionId)
      setInterrupted((current) => current.filter((item) => item.sessionId !== sessionId))
    },
    [store],
  )

  const claim = useCallback(
    (query: ResumableQuery): ResumableUpload | undefined => {
      if (!store) return undefined
      const record = findResumable(store.list(), query, claimedRef.current)
      if (!record) return undefined
      claimedRef.current.add(record.sessionId)
      setInterrupted((current) => current.filter((item) => item.sessionId !== record.sessionId))
      return record
    },
    [store],
  )

  return { interrupted, discard, claim }
}

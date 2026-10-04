import { api, isRateLimitError, toApiError, unwrap } from '@/shared/api/client'
import type { ApiObjResponse } from '@/shared/types/api'

import { uploadCompleteResponseSchema, uploadInitResponseSchema, uploadStatusResponseSchema } from '../types'

// CLAUDE.md §7.4: tamaño de chunk fijo, dentro del margen que documenta el
// propio backend (UploadController.ReceiveChunkAsync: RequestSizeLimit de
// 35MB "margen sobre chunks de 20-30MB").
export const CHUNK_SIZE_BYTES = 24 * 1024 * 1024

// Nº máximo de archivos subiendo a la vez. Dentro de cada archivo los chunks
// van secuenciales (nunca en paralelo). Protege el rate limit global del
// backend (100 req/min por IP, compartido con el resto de la app — ver
// RateLimiterExtensions.cs) — sin este límite, subir varios archivos grandes
// a la vez agota el cupo y empieza a devolver 429 a mitad de una subida. Si
// aun así se agota (muchos archivos pequeños = 3 peticiones cada uno), la
// cola se pausa entera y se reanuda sola, ver rateLimit.ts.
export const MAX_CONCURRENT_UPLOADS = 2

const MAX_CHUNK_ATTEMPTS = 3
const BASE_RETRY_DELAY_MS = 500

// CLAUDE.md §7.4: sin progreso nuevo durante 20s se considera una conexión
// realmente colgada (no solo lenta) y se aborta para que uploadChunkWithRetry
// lo trate como un fallo transitorio más. Un timeout fijo de duración total
// (como el de 30s de la instancia de axios, client.ts) mataría un chunk de
// 24MB legítimamente lento en una conexión pobre aunque siguiera avanzando —
// por eso este chunk desactiva ese timeout (`timeout: 0`) y usa en su lugar
// este temporizador que se reinicia en cada evento de progreso real.
const STALL_TIMEOUT_MS = 20_000

export type ChunkPlan = {
  totalChunks: number
  /** Tamaño real de cada chunk en bytes — todos iguales a CHUNK_SIZE_BYTES salvo el último. */
  chunkSizes: number[]
}

/** Pura y testeable (CLAUDE.md §9): cuántos chunks hacen falta y de qué tamaño exacto cada uno. */
export function computeChunkPlan(totalSizeBytes: number, chunkSizeBytes: number = CHUNK_SIZE_BYTES): ChunkPlan {
  const totalChunks = Math.max(1, Math.ceil(totalSizeBytes / chunkSizeBytes))
  const chunkSizes = Array.from({ length: totalChunks }, (_, index) => {
    const isLast = index === totalChunks - 1
    return isLast ? totalSizeBytes - chunkSizeBytes * index : chunkSizeBytes
  })
  return { totalChunks, chunkSizes }
}

/** Backoff exponencial simple entre reintentos de un mismo chunk (500ms, 1s, 2s...). */
export function backoffDelayMs(attempt: number): number {
  return BASE_RETRY_DELAY_MS * 2 ** (attempt - 1)
}

/**
 * % agregado sobre el tamaño TOTAL del archivo, no del chunk en curso — evita
 * que la barra dé saltos bruscos entre chunks grandes (§6.4).
 */
export function aggregateProgress(
  chunkSizes: number[],
  doneChunkCount: number,
  currentChunkLoadedBytes: number,
  totalSizeBytes: number,
): number {
  if (totalSizeBytes <= 0) return 0
  const doneBytes = chunkSizes.slice(0, doneChunkCount).reduce((sum, size) => sum + size, 0)
  return Math.min(100, Math.round(((doneBytes + currentChunkLoadedBytes) / totalSizeBytes) * 100))
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** POST /files/upload/init — UploadController.InitUploadSessionAsync. */
export async function initUploadSession(
  params: { fileName: string; totalSizeBytes: number; totalChunks: number; folderId: number | null },
  signal: AbortSignal,
): Promise<string> {
  const response = await api.post<ApiObjResponse<unknown>>(
    '/files/upload/init',
    {
      fileName: params.fileName,
      totalSizeBytes: params.totalSizeBytes,
      totalChunks: params.totalChunks,
      folderId: params.folderId,
    },
    { signal },
  )
  return uploadInitResponseSchema.parse(unwrap(response.data)).sessionId
}

async function sendChunk(
  sessionId: string,
  chunkNumber: number,
  blob: Blob,
  signal: AbortSignal,
  onProgress: (loadedBytes: number) => void,
): Promise<void> {
  const formData = new FormData()
  formData.append('sessionId', sessionId)
  formData.append('chunkNumber', String(chunkNumber))
  formData.append('chunk', blob)

  // Puente entre la cancelación real (signal, viene de cancelEntry/§7.4) y el
  // aborto por stall de abajo — cualquiera de los dos corta la petición.
  const requestController = new AbortController()
  const onOuterAbort = () => requestController.abort()
  signal.addEventListener('abort', onOuterAbort)

  let stallTimer: ReturnType<typeof setTimeout> | undefined
  const resetStallTimer = () => {
    clearTimeout(stallTimer)
    stallTimer = setTimeout(() => requestController.abort(), STALL_TIMEOUT_MS)
  }
  resetStallTimer()

  try {
    const response = await api.post<ApiObjResponse<unknown>>('/files/upload/chunk', formData, {
      signal: requestController.signal,
      timeout: 0, // sin techo de duración total — lo controla el temporizador de stall
      onUploadProgress: (event) => {
        resetStallTimer()
        onProgress(event.loaded)
      },
    })
    unwrap(response.data)
  } finally {
    clearTimeout(stallTimer)
    signal.removeEventListener('abort', onOuterAbort)
  }
}

/**
 * CLAUDE.md §7.4: reintenta un chunk hasta MAX_CHUNK_ATTEMPTS veces con
 * backoff antes de propagar el error — un chunk suelto puede fallar por un
 * corte de red momentáneo o un 429 puntual del rate limiter sin que haga
 * falta perder el archivo entero. Cancelación explícita (AbortController) se
 * propaga de inmediato, sin reintentar.
 *
 * Un 429 tampoco se reintenta aquí: el backoff de 0.5-2s no sirve contra un
 * cupo que tarda ~60s en reponerse y solo malgastaría los intentos. Se
 * propaga de inmediato para que `withRateLimitRetry` (rateLimit.ts) pause toda
 * la cola y vuelva a lanzar el chunk cuando el cupo se haya repuesto.
 */
export async function uploadChunkWithRetry(
  sessionId: string,
  chunkNumber: number,
  blob: Blob,
  signal: AbortSignal,
  onProgress: (loadedBytes: number) => void,
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_CHUNK_ATTEMPTS; attempt++) {
    try {
      await sendChunk(sessionId, chunkNumber, blob, signal, onProgress)
      return
    } catch (error) {
      const apiError = toApiError(error)
      if (signal.aborted || attempt === MAX_CHUNK_ATTEMPTS || isRateLimitError(apiError)) throw apiError
      onProgress(0) // el intento fallido no cuenta como progreso parcial
      await delay(backoffDelayMs(attempt))
    }
  }
}

/** GET /files/upload/{sessionId}/status — usado solo para reanudar tras un error (§7.4), nunca en el camino feliz. */
export async function getUploadStatus(sessionId: string, signal: AbortSignal): Promise<number[]> {
  const response = await api.get<ApiObjResponse<unknown>>(`/files/upload/${sessionId}/status`, { signal })
  return uploadStatusResponseSchema.parse(unwrap(response.data)).receivedChunks
}

/** POST /files/upload/{sessionId}/complete — puede devolver el DTO o un string si ya estaba completada (ver uploadCompleteResponseSchema). */
export async function completeUploadSession(sessionId: string, signal: AbortSignal) {
  const response = await api.post<ApiObjResponse<unknown>>(`/files/upload/${sessionId}/complete`, undefined, {
    signal,
  })
  return uploadCompleteResponseSchema.parse(unwrap(response.data))
}

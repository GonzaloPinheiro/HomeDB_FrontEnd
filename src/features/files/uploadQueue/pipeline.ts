import { api, isRateLimitError, toApiError, unwrap } from '@/shared/api/client'
import type { ApiObjResponse } from '@/shared/types/api'

import {
  uploadCompleteResponseSchema,
  uploadInitResponseSchema,
  uploadStatusResponseSchema,
  type UploadStatusResponse,
} from '../types'

// CLAUDE.md §7.4: límite de la petición de chunk en el backend
// (UploadController.ReceiveChunkAsync: `[RequestSizeLimit(35_000_000)]`, en bytes
// decimales — 35 MB, no 35 MiB). Es el techo duro: un chunk que lo supere recibe
// un 413 y no hay reintento que lo arregle. Se mantiene aquí como constante solo
// para poder comprobar el invariante en pipeline.test.ts si alguien sube el chunk.
export const BACKEND_CHUNK_REQUEST_LIMIT_BYTES = 35_000_000

// CLAUDE.md §7.4: tamaño de chunk fijo, el mayor potencia de 2 que cabe bajo el
// límite del backend: 32 MiB = 33.554.432 B, deja ~1,4 MB de margen para el
// sobre multipart (nombres de campo, sessionId, chunkNumber, cabeceras). 33 MiB
// ya dejaría solo ~0,4 MB, demasiado ajustado. Un chunk mayor reduce el nº de
// peticiones (menos cupo del rate limiter, menos viajes ida y vuelta), pero cada
// fallo repite más datos — a partir de aquí el beneficio es marginal.
export const CHUNK_SIZE_BYTES = 32 * 1024 * 1024

// CLAUDE.md §7.4 — EL ÚNICO MANDO del paralelismo de subida. Nº máximo de chunks
// en vuelo a la vez en TODA la cola (suma de todos los archivos); un archivo
// grande puede usarlos todos. Subirlo o bajarlo es tocar solo este número:
// concurrency.ts lo aplica con un semáforo global, no hay otro sitio que ajustar.
// Con 1 se vuelve al comportamiento secuencial de antes. Valor 4: suficiente
// para tapar la latencia de cada petición (el servidor es una Raspberry Pi
// detrás de un túnel de Cloudflare) sin saturar su disco ni la subida del
// usuario; si el enlace ya va al máximo con un chunk, subirlo no acelera nada.
export const MAX_PARALLEL_CHUNK_UPLOADS = 4

// Nº máximo de archivos subiendo a la vez (cada uno con su sesión). Es
// independiente del paralelismo de chunks de arriba: el tope de chunks en vuelo
// es global, así que más archivos simultáneos no multiplican las peticiones,
// solo se reparten los mismos huecos. Dentro de cada archivo los chunks se
// reparten entre los workers de concurrency.ts. Protege el rate limit global del
// backend (compartido con el resto de la app — RateLimiterExtensions.cs): si
// aun así se agota (muchos archivos pequeños = 3 peticiones cada uno), la cola
// se pausa entera y se reanuda sola, ver rateLimit.ts.
export const MAX_CONCURRENT_UPLOADS = 2

const MAX_CHUNK_ATTEMPTS = 3
const BASE_RETRY_DELAY_MS = 500

// CLAUDE.md §7.4: sin progreso nuevo durante 20s se considera una conexión
// realmente colgada (no solo lenta) y se aborta para que uploadChunkWithRetry
// lo trate como un fallo transitorio más. Un timeout fijo de duración total
// (como el de 30s de la instancia de axios, client.ts) mataría un chunk de
// 32MB legítimamente lento en una conexión pobre aunque siguiera avanzando —
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
 * Bytes ya enviados del archivo entero: suma, chunk a chunk, lo enviado de cada
 * uno (`loadedBytesPerChunk[i]`: su tamaño completo si está confirmado, un valor
 * parcial si va en vuelo, 0 si no ha empezado). Se indexa por chunk y no se
 * cuenta "los N primeros" porque con subidas en paralelo (y al reanudar) los
 * chunks terminados no son un prefijo. Cada valor se acota a su chunk:
 * `onUploadProgress` cuenta también el sobre multipart, que haría pasarse del
 * tamaño real.
 */
export function loadedBytesTotal(chunkSizes: number[], loadedBytesPerChunk: number[]): number {
  let loadedBytes = 0
  chunkSizes.forEach((size, index) => {
    loadedBytes += Math.min(Math.max(loadedBytesPerChunk[index] ?? 0, 0), size)
  })
  return loadedBytes
}

/**
 * % agregado sobre el tamaño TOTAL del archivo, no del chunk en curso — evita
 * que la barra dé saltos bruscos entre chunks grandes (§6.4).
 */
export function aggregateProgress(
  chunkSizes: number[],
  loadedBytesPerChunk: number[],
  totalSizeBytes: number,
): number {
  if (totalSizeBytes <= 0) return 0
  return Math.min(100, Math.round((loadedBytesTotal(chunkSizes, loadedBytesPerChunk) / totalSizeBytes) * 100))
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

/**
 * GET /files/upload/{sessionId}/status. Dos usos (CLAUDE.md §7.4): al reanudar
 * una entrada con sesión (qué chunks tiene ya el servidor y en qué estado está
 * la sesión) y, tras `complete`, en bucle (completion.ts) hasta que el worker
 * en background termina de ensamblar.
 */
export async function getUploadStatus(sessionId: string, signal: AbortSignal): Promise<UploadStatusResponse> {
  const response = await api.get<ApiObjResponse<unknown>>(`/files/upload/${sessionId}/status`, { signal })
  return uploadStatusResponseSchema.parse(unwrap(response.data))
}

/**
 * POST /files/upload/{sessionId}/complete — solo ENCOLA el ensamblado: el backend
 * valida que lleguen todos los chunks, marca la sesión como `Processing` y
 * responde 202 al instante; el archivo se ensambla en un worker en background
 * (UploadCompletionQueue). El resultado (archivo creado o motivo del fallo) se
 * consulta con GET /status — ver completion.ts. Es idempotente: repetirlo con la
 * sesión ya en proceso o completada vuelve a dar 202 sin reencolar.
 *
 * CLAUDE.md §7.4: ya NO va sin timeout (antes bloqueaba hasta ensamblar, minutos
 * con decenas de GB, y un timeout o el límite de ~100s de Cloudflare cancelaba la
 * sesión). Ahora usa el timeout por defecto de `api`: tarda lo que una petición
 * JSON normal.
 */
export async function completeUploadSession(sessionId: string, signal: AbortSignal): Promise<void> {
  const response = await api.post<ApiObjResponse<unknown>>(`/files/upload/${sessionId}/complete`, undefined, { signal })
  uploadCompleteResponseSchema.parse(unwrap(response.data))
}

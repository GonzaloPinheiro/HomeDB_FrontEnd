import { api, isRateLimitError, isStorageLocationError, toApiError, unwrap } from '@/shared/api/client'
import type { ApiObjResponse } from '@/shared/types/api'

import {
  uploadCompleteResponseSchema,
  uploadFileResponseSchema,
  uploadInitResponseSchema,
  uploadStatusResponseSchema,
  type UploadFileResponse,
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

// CLAUDE.md §7.4: una vez enviado el cuerpo entero de una subida directa ya no llegan
// eventos de progreso, así que el temporizador de stall de arriba (20 s) mediría lo
// que tarda el SERVIDOR en validar, escribir y responder, no la conexión. Se amplía
// para ese tramo: el servidor tiene que comprobar la cabecera, escribir hasta 10 MiB y
// guardar el registro. Al agotarse el resultado es DESCONOCIDO (UploadOutcomeUnknownError).
const DIRECT_RESPONSE_TIMEOUT_MS = 60_000

// CLAUDE.md §5.4/§7.4: subida directa (un archivo en UNA petición, `POST
// /files/upload/single`). Techo duro del backend: `UploadLimits.SingleUploadMaxFileBytes`
// (20 MiB, constante de compilación; el servidor rechaza con 413 lo que lo supere y
// además limita la petición entera a ese tamaño + 1 MiB de margen multipart).
export const BACKEND_SINGLE_UPLOAD_MAX_FILE_BYTES = 20 * 1024 * 1024

// Umbral del front: hasta aquí (inclusive) un archivo va directo; por encima, por
// chunks. Decisión de este front, NO del backend, y deliberadamente por debajo de su
// techo: lo que se gana es sobre todo en archivos pequeños (se ahorran 3 de cada 4
// peticiones y el sondeo, un coste fijo por archivo), mientras que el riesgo de la
// subida directa crece con el tamaño — un fallo repite el archivo ENTERO (el chunk
// solo repite 32 MiB, y la sesión reanuda) y no es idempotente (ver
// `uploadSingleFile`). Es el único mando: subirlo o bajarlo es tocar solo este número
// (pipeline.test.ts comprueba que cabe en el límite del backend).
export const DIRECT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024

/** ¿Va este archivo por la subida directa? Un archivo vacío no (el backend lo rechaza en las dos vías y ya se descarta al encolar, §7.4). */
export function shouldUploadDirect(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= DIRECT_UPLOAD_MAX_BYTES
}

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
 *
 * Tampoco se reintenta un 1028/1029 (disco temporal caído o sin espacio,
 * CLAUDE.md §5.4): un disco que cae no vuelve en los ~3,5 s del backoff, y cada
 * intento gastaría cupo del rate limiter global con cuatro chunks en vuelo.
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
      if (
        signal.aborted ||
        attempt === MAX_CHUNK_ATTEMPTS ||
        isRateLimitError(apiError) ||
        isStorageLocationError(apiError)
      ) {
        throw apiError
      }
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

/**
 * El cuerpo de una subida directa llegó entero al servidor pero no se recibió la
 * respuesta (corte de red o plazo agotado): el archivo PUEDE haberse guardado ya.
 * Reintentar a ciegas crearía un duplicado (el backend admite nombres repetidos), así
 * que el llamante NO debe reintentarlo solo — ni al volver la conexión — y el mensaje
 * pide al usuario mirar la carpeta antes. Es la diferencia clave con la subida por
 * chunks, donde repetir es idempotente. No extiende `ApiError`: no es un fallo de red
 * (que sí se reintenta solo, §7.4) ni una respuesta del backend.
 */
export class UploadOutcomeUnknownError extends Error {
  constructor() {
    super(
      'No se pudo confirmar si el archivo se subió: la conexión se perdió al terminar. Revisa la carpeta antes de reintentar para no duplicarlo',
    )
    this.name = 'UploadOutcomeUnknownError'
  }
}

type SingleAttemptOutcome = { kind: 'ok'; file: UploadFileResponse } | { kind: 'unsent'; error: unknown }

async function attemptSingleUpload(
  file: File,
  folderId: number | null,
  signal: AbortSignal,
  onProgress: (loadedBytes: number) => void,
): Promise<SingleAttemptOutcome> {
  // El campo se llama `file` y `folderId` solo se envía si hay carpeta (UploadController.
  // UploadSingleAsync: `int? folderId`; ausente = raíz). El nombre lo sanea el servidor.
  const formData = new FormData()
  formData.append('file', file)
  if (folderId !== null) formData.append('folderId', String(folderId))

  // Mismo puente cancelación/stall que `sendChunk`.
  const requestController = new AbortController()
  const onOuterAbort = () => requestController.abort()
  signal.addEventListener('abort', onOuterAbort)

  let bodyFullySent = false
  let stallTimer: ReturnType<typeof setTimeout> | undefined
  const armTimer = (ms: number) => {
    clearTimeout(stallTimer)
    stallTimer = setTimeout(() => requestController.abort(), ms)
  }
  armTimer(STALL_TIMEOUT_MS)

  try {
    const response = await api.post<ApiObjResponse<unknown>>('/files/upload/single', formData, {
      signal: requestController.signal,
      timeout: 0, // sin techo de duración total — lo controlan los temporizadores de arriba
      onUploadProgress: (event) => {
        onProgress(event.loaded)
        // axios emite un último evento al terminar de enviar (`loadend`) con loaded === total.
        if (event.total !== undefined && event.loaded >= event.total) {
          bodyFullySent = true
          armTimer(DIRECT_RESPONSE_TIMEOUT_MS)
        } else {
          armTimer(STALL_TIMEOUT_MS)
        }
      },
    })
    return { kind: 'ok', file: uploadFileResponseSchema.parse(unwrap(response.data)) }
  } catch (error) {
    if (signal.aborted) throw toApiError(error)
    const apiError = toApiError(error)
    // Hubo respuesta del backend (cualquier código HTTP): es un resultado, no una duda.
    if (apiError.httpStatus !== null) throw apiError
    // Sin respuesta y con el cuerpo ya entregado: el servidor pudo guardarlo.
    if (bodyFullySent) throw new UploadOutcomeUnknownError()
    // Sin respuesta y sin haber terminado de enviar: el servidor no recibió el archivo
    // entero (un multipart truncado no se procesa), así que repetirlo es seguro.
    return { kind: 'unsent', error: apiError }
  } finally {
    clearTimeout(stallTimer)
    signal.removeEventListener('abort', onOuterAbort)
  }
}

/**
 * POST /files/upload/single — sube un archivo (≤ `DIRECT_UPLOAD_MAX_BYTES`) en una sola
 * petición y devuelve el archivo creado. El servidor aplica las mismas validaciones que
 * la subida por chunks (extensión, magic numbers, tamaño, cuota, disco, §5.4) pero TODAS
 * de forma síncrona: un archivo con contenido que no coincide con su extensión llega
 * aquí como error 400/1027, no por `GET /status`.
 *
 * Reintentos (CLAUDE.md §7.4), más estrictos que los de un chunk porque repetir NO es
 * idempotente: solo se repite, hasta `MAX_CHUNK_ATTEMPTS` veces con backoff, si la
 * conexión cayó ANTES de terminar de enviar el cuerpo. Cualquier respuesta del backend
 * (400, 413, 503, 507, 5xx…) se propaga tal cual, y un corte DESPUÉS de enviarlo todo lanza
 * `UploadOutcomeUnknownError`. Un 429 se propaga también: lo repite `withRateLimitRetry`
 * (rateLimit.ts) tras pausar toda la cola, y es seguro — el limitador rechaza antes de
 * ejecutar el endpoint.
 */
export async function uploadSingleFile(
  file: File,
  folderId: number | null,
  signal: AbortSignal,
  onProgress: (loadedBytes: number) => void,
): Promise<UploadFileResponse> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_CHUNK_ATTEMPTS; attempt++) {
    const outcome = await attemptSingleUpload(file, folderId, signal, onProgress)
    if (outcome.kind === 'ok') return outcome.file
    lastError = outcome.error
    onProgress(0) // el intento fallido no cuenta como progreso parcial
    if (attempt < MAX_CHUNK_ATTEMPTS) await delay(backoffDelayMs(attempt))
  }
  throw lastError
}

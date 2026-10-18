import { ApiError, toApiError } from '@/shared/api/client'
import { ApiErrorCodes, getErrorMessage } from '@/shared/api/errors'

import type { UploadStatusResponse } from '../types'
import { abortableDelay } from './rateLimit'

// CLAUDE.md §7.4: tras `complete` (202) el backend ensambla el archivo en un
// worker en background, y el front espera el resultado consultando GET /status.
// Todo lo que sigue son decisiones del front (el backend no expone nada de esto):
// cuándo preguntar, cuánto esperar y cuándo darse por vencido.

/** Primera consulta tras `complete`: casi siempre ya ha terminado si el archivo es pequeño. */
const POLL_BASE_DELAY_MS = 1_000
/** Techo del intervalo de una entrada: un ensamblado largo no necesita más de una consulta cada 5 s. */
const POLL_MAX_DELAY_MS = 5_000
const POLL_GROWTH_FACTOR = 1.5

/**
 * Presupuesto global de consultas: cada entrada que espera deja pasar al menos
 * esto por cada entrada que espera a la vez (≈ 2 consultas/s en total). Sin él,
 * un lote de 100 archivos pequeños lanzaría 100 consultas por segundo y se
 * comería de golpe el cupo del rate limiter global (500 req/min, compartido con
 * toda la app, §7.4). El worker del backend es secuencial, así que consultar más
 * a menudo no adelanta nada.
 */
const POLL_MIN_MS_PER_WAITING_ENTRY = 500
/** Cota al intervalo anterior cuando hay muchísimas entradas esperando. */
const POLL_ABSOLUTE_MAX_DELAY_MS = 30_000

/** Consultas seguidas que pueden fallar por red/5xx antes de dar la entrada por fallida. */
export const MAX_CONSECUTIVE_POLL_FAILURES = 5

/**
 * Plazo máximo de espera = base + tiempo de ensamblar a una velocidad MÍNIMA
 * pesimista. Existe porque el backend puede dejar una sesión en `Processing` para
 * siempre (un reinicio del servidor pierde la cola en memoria, o un fallo al
 * mover el archivo a su destino no la saca de ese estado) y sin plazo la entrada
 * se quedaría "procesando" eternamente. 5 MB/s queda muy por debajo de lo que da
 * una Raspberry Pi concatenando en disco (25 GB → ~83 min de plazo): un falso
 * positivo (dar por fallida una subida que iba bien) es peor que esperar de más.
 */
export const PROCESSING_BASE_TIMEOUT_MS = 2 * 60_000
export const MIN_ASSEMBLY_BYTES_PER_SEC = 5 * 1024 * 1024

/**
 * Milisegundos a esperar antes de la consulta nº `pollNumber` (0 = la primera
 * tras `complete`): crece de 1 s a 5 s, y se ensancha si hay muchas entradas
 * esperando a la vez (`waitingEntries`, ver POLL_MIN_MS_PER_WAITING_ENTRY).
 */
export function pollDelayMs(pollNumber: number, waitingEntries: number): number {
  const backoff = Math.min(POLL_BASE_DELAY_MS * POLL_GROWTH_FACTOR ** pollNumber, POLL_MAX_DELAY_MS)
  return Math.min(Math.max(backoff, waitingEntries * POLL_MIN_MS_PER_WAITING_ENTRY), POLL_ABSOLUTE_MAX_DELAY_MS)
}

/**
 * Plazo de espera de una entrada. El worker del backend procesa las subidas de
 * una en una (en orden de llegada), así que además de su propio tamaño cuenta lo
 * que ya tenía delante (`backlogBytes`: lo de las demás entradas del front que
 * estaban esperando cuando esta entró).
 */
export function processingTimeoutMs(ownBytes: number, backlogBytes: number): number {
  return PROCESSING_BASE_TIMEOUT_MS + ((ownBytes + backlogBytes) / MIN_ASSEMBLY_BYTES_PER_SEC) * 1000
}

/**
 * La sesión terminó en `Cancelled` en el backend: el ensamblado o su validación
 * fallaron (tamaño que no cuadra, extensión/contenido no permitido, error
 * interno). Es un rechazo definitivo de ESA sesión — reintentar con GET /status
 * volvería a ver lo mismo, así que quien la captura descarta el `sessionId` y el
 * siguiente intento empieza una subida nueva (UploadQueueContext).
 */
export class UploadSessionEndedError extends ApiError {
  // Sin parameter properties: el tsconfig activa `erasableSyntaxOnly`.
  constructor(errorCode: number | null) {
    // Una sesión cancelada sin código (p. ej. por superar el tamaño máximo en
    // un chunk) no dice más que "ya no está activa".
    const code = errorCode ?? ApiErrorCodes.UploadSessionNotActive
    super(code, getErrorMessage(code))
    this.name = 'UploadSessionEndedError'
  }
}

/** Se agotó el plazo de espera sin ver la sesión en un estado terminal (ver PROCESSING_BASE_TIMEOUT_MS). */
export class ProcessingTimeoutError extends Error {
  constructor() {
    super(
      'El servidor tarda más de lo esperado en procesar el archivo. Puede que ya esté subido: revisa la carpeta antes de reintentar',
    )
    this.name = 'ProcessingTimeoutError'
  }
}

/** Red caída, corte o 5xx: el siguiente intento puede salir bien. Un 4xx es una respuesta definitiva del backend. */
function isTransientFailure(error: ApiError): boolean {
  return error.httpStatus === null || error.httpStatus >= 500
}

type WaitForCompletionParams = {
  /** Una consulta a GET /status (el llamante la envuelve con la pausa por rate limit). */
  fetchStatus: () => Promise<UploadStatusResponse>
  signal: AbortSignal
  /** Ver processingTimeoutMs. */
  timeoutMs: number
  /** Cuántas entradas esperan ahora mismo, incluida esta — ver pollDelayMs. */
  waitingEntries: () => number
  now?: () => number
}

/**
 * Consulta GET /status hasta que la sesión llega a un estado terminal.
 * Devuelve el estado `completed` (con el archivo creado en `file`); lanza
 * `UploadSessionEndedError` si acabó `cancelled`, `ProcessingTimeoutError` si
 * se agota el plazo, y el error real de la petición si falla de forma
 * definitiva (4xx) o MAX_CONSECUTIVE_POLL_FAILURES veces seguidas por red/5xx.
 * Se cancela con `signal`.
 */
export async function waitForUploadCompletion({
  fetchStatus,
  signal,
  timeoutMs,
  waitingEntries,
  now = Date.now,
}: WaitForCompletionParams): Promise<UploadStatusResponse> {
  const deadline = now() + timeoutMs
  let consecutiveFailures = 0

  for (let pollNumber = 0; ; pollNumber++) {
    await abortableDelay(pollDelayMs(pollNumber, waitingEntries()), signal)

    try {
      const status = await fetchStatus()
      consecutiveFailures = 0
      if (status.status === 'completed') return status
      if (status.status === 'cancelled') throw new UploadSessionEndedError(status.errorCode)
      // 'processing' (lo esperable) o 'inProgress' (no debería verse tras un
      // `complete` aceptado): se sigue esperando, acotado por el plazo.
    } catch (error) {
      if (error instanceof UploadSessionEndedError) throw error
      const apiError = toApiError(error)
      consecutiveFailures++
      if (signal.aborted || !isTransientFailure(apiError) || consecutiveFailures >= MAX_CONSECUTIVE_POLL_FAILURES) {
        throw apiError
      }
    }

    if (now() >= deadline) throw new ProcessingTimeoutError()
  }
}

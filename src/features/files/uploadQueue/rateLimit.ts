import { isRateLimitError, toApiError } from '@/shared/api/client'

// CLAUDE.md §5.4/§7.4: el backend responde 429 con `Retry-After: 60` y su token
// bucket global (100 req/min por IP, repuesto de golpe cada 60s) se comparte
// con TODA la app. Este valor es el de reserva cuando el navegador no puede
// leer la cabecera (hoy no la expone por CORS, ver parseRetryAfterMs).
export const DEFAULT_RATE_LIMIT_PAUSE_MS = 60_000

// Tope de pausas consecutivas por petición antes de rendirse y dejar el
// archivo en error (5 min en total con el valor por defecto) — evita esperar
// para siempre si algo externo mantiene el cupo agotado.
export const MAX_RATE_LIMIT_PAUSES = 5

// Cota a un Retry-After disparatado (cabecera mal formada o reloj desajustado).
const MAX_PAUSE_MS = 5 * 60_000

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Semáforo compartido por todas las subidas de la cola: cuando UNA petición
 * recibe un 429, TODAS esperan a que pase la pausa antes de lanzar la
 * siguiente.
 *
 * Sin esto, cada archivo falla por su cuenta en cuanto el cupo se agota — y
 * como cada fallo libera un hueco de concurrencia (MAX_CONCURRENT_UPLOADS),
 * arranca el siguiente archivo en cola, su `init` también recibe 429 y falla
 * al instante: la cola entera se quema en segundos con todos en error.
 */
export class RateLimitGate {
  private resumeAt = 0
  private readonly now: () => number
  private readonly onPause?: (resumeAt: number) => void

  // Sin parameter properties: el tsconfig activa `erasableSyntaxOnly`.
  constructor(now: () => number = Date.now, onPause?: (resumeAt: number) => void) {
    this.now = now
    this.onPause = onPause
  }

  /** Bloquea toda petición nueva durante `ms`. Si ya había una pausa más larga, no la acorta. */
  pause(ms: number): void {
    const clamped = Math.min(Math.max(ms, 0), MAX_PAUSE_MS)
    this.resumeAt = Math.max(this.resumeAt, this.now() + clamped)
    this.onPause?.(this.resumeAt)
  }

  remainingMs(): number {
    return Math.max(0, this.resumeAt - this.now())
  }

  /** Resuelve cuando no hay pausa activa; rechaza si `signal` se aborta mientras espera (cancelar un archivo en pausa). */
  async wait(signal: AbortSignal): Promise<void> {
    let remaining = this.remainingMs()
    while (remaining > 0) {
      await abortableDelay(remaining, signal)
      remaining = this.remainingMs() // otra petición pudo alargar la pausa mientras esperábamos
    }
  }
}

/**
 * Ejecuta `request` respetando la pausa global: espera si la hay, y si la
 * propia petición recibe un 429 la activa y la reintenta cuando termine, sin
 * contarlo como fallo del archivo. Un 429 no consume tokens del rate limiter
 * (lo rechaza el middleware antes de llegar al controller), así que repetir la
 * petición — incluso `complete`, que no es idempotente — es seguro.
 */
export async function withRateLimitRetry<T>(
  gate: RateLimitGate,
  signal: AbortSignal,
  request: () => Promise<T>,
  maxPauses: number = MAX_RATE_LIMIT_PAUSES,
): Promise<T> {
  for (let pauses = 0; ; pauses++) {
    await gate.wait(signal)
    try {
      return await request()
    } catch (error) {
      const apiError = toApiError(error)
      if (signal.aborted || !isRateLimitError(apiError) || pauses >= maxPauses) throw error
      gate.pause(apiError.retryAfterMs ?? DEFAULT_RATE_LIMIT_PAUSE_MS)
    }
  }
}

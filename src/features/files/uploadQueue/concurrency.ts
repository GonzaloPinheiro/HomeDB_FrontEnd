// CLAUDE.md §7.4: piezas de concurrencia de la subida por chunks. Son lógica
// pura (sin axios ni React) para poder testearlas directamente (§9).

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError')
}

/**
 * Semáforo asíncrono con cola FIFO. Limita cuántos chunks viajan a la vez en
 * TODA la cola de subidas, sumando todos los archivos: sin él, el paralelismo
 * por archivo se multiplicaría por MAX_CONCURRENT_UPLOADS (§7.4).
 */
export class AsyncSemaphore {
  private available: number
  private readonly waiters: Array<() => void> = []

  // Sin parameter properties: el tsconfig activa `erasableSyntaxOnly`.
  constructor(capacity: number) {
    this.available = Math.max(1, Math.floor(capacity))
  }

  /**
   * Resuelve con la función que libera el hueco (idempotente). Rechaza con un
   * AbortError si `signal` se aborta mientras espera — un archivo cancelado no
   * debe quedarse en la cola del semáforo ni consumir un hueco al llegarle el turno.
   */
  acquire(signal: AbortSignal): Promise<() => void> {
    if (signal.aborted) return Promise.reject(abortError())
    if (this.available > 0) {
      this.available -= 1
      return Promise.resolve(this.createRelease())
    }
    return new Promise<() => void>((resolve, reject) => {
      const onAbort = () => {
        const index = this.waiters.indexOf(grant)
        if (index >= 0) this.waiters.splice(index, 1)
        reject(abortError())
      }
      const grant = () => {
        signal.removeEventListener('abort', onAbort)
        resolve(this.createRelease())
      }
      this.waiters.push(grant)
      signal.addEventListener('abort', onAbort, { once: true })
    })
  }

  private createRelease(): () => void {
    let released = false
    return () => {
      if (released) return
      released = true
      const next = this.waiters.shift()
      // El hueco pasa directo al siguiente en la cola, sin volver a `available`.
      if (next) next()
      else this.available += 1
    }
  }
}

export type ConcurrencyOptions = {
  /** Nº máximo de tareas de ESTE lote en vuelo a la vez (tope por archivo). */
  concurrency: number
  /** Tope compartido con el resto de lotes (tope global de la cola). */
  semaphore: AsyncSemaphore
  /** Cancelación externa (el usuario cancela el archivo). */
  signal: AbortSignal
}

/**
 * Ejecuta `task` sobre cada elemento con hasta `concurrency` tareas a la vez y
 * sin superar nunca el tope global del `semaphore`.
 *
 * - Los elementos se reparten en orden; un worker libre toma el siguiente.
 * - Al primer fallo no se arranca ningún elemento más y se aborta el `signal`
 *   que reciben las tareas en vuelo, para que no sigan gastando ancho de banda
 *   en un archivo que ya está condenado. Se espera a que TODAS terminen antes
 *   de resolver, así nunca quedan peticiones huérfanas tras volver.
 * - Rechaza con el PRIMER error real (no con los AbortError que el propio abort
 *   provoca en las demás). Si solo hubo cancelación externa, rechaza con AbortError.
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  options: ConcurrencyOptions,
  task: (item: T, signal: AbortSignal) => Promise<void>,
): Promise<void> {
  const { semaphore, signal } = options
  const concurrency = Math.max(1, Math.floor(options.concurrency))

  const poolController = new AbortController()
  const onExternalAbort = () => poolController.abort()
  if (signal.aborted) poolController.abort()
  else signal.addEventListener('abort', onExternalAbort, { once: true })

  let cursor = 0
  // Objeto contenedor y no `let`: TS estrecharía una variable asignada solo
  // desde closures a `null` y no dejaría leer el error al final.
  const state: { failure: { error: unknown } | null } = { failure: null }

  const worker = async (): Promise<void> => {
    while (!poolController.signal.aborted) {
      let release: () => void
      try {
        release = await semaphore.acquire(poolController.signal)
      } catch {
        return // abortado esperando turno
      }
      try {
        if (cursor >= items.length) return
        const item = items[cursor]
        cursor += 1
        await task(item, poolController.signal)
      } catch (error) {
        // Si el pool ya estaba abortado, este error es un efecto colateral
        // (cancelación o fallo de otra tarea), no un fallo propio.
        if (!poolController.signal.aborted) {
          state.failure = { error }
          poolController.abort()
        }
        return
      } finally {
        release()
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  } finally {
    signal.removeEventListener('abort', onExternalAbort)
  }

  if (state.failure) throw state.failure.error
  if (signal.aborted) throw abortError()
}

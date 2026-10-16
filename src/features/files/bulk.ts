// CLAUDE.md §6.3: operaciones por lote del explorador (eliminar / mover varios).
// No hay endpoints por lote en el backend: cada elemento es su propia petición.
// Lógica pura (sin axios ni React) para testearla directamente (§9).

/** Peticiones simultáneas. Pocas a propósito: el rate limit es global y compartido con la cola de subidas (§7.4). */
export const BULK_CONCURRENCY = 3

export type BulkFailure<T> = { item: T; error: unknown }
export type BulkResult<T> = { succeeded: T[]; failed: BulkFailure<T>[] }

/**
 * Ejecuta `task` sobre cada elemento con hasta `concurrency` a la vez y NUNCA
 * lanza: un fallo de un elemento no debe impedir que se intenten los demás
 * (borrar 10 archivos y que el 3º falle no puede dejar los otros 7 sin tocar
 * ni sin informar). Devuelve qué salió bien y qué no, para un único resumen.
 */
export async function runBulk<T>(
  items: readonly T[],
  task: (item: T) => Promise<void>,
  concurrency: number = BULK_CONCURRENCY,
): Promise<BulkResult<T>> {
  const succeeded: T[] = []
  const failed: BulkFailure<T>[] = []
  let cursor = 0

  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const item = items[cursor]
      cursor += 1
      try {
        await task(item)
        succeeded.push(item)
      } catch (error) {
        failed.push({ item, error })
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, worker))
  return { succeeded, failed }
}

type OutcomeLabels = {
  /** Texto de éxito total, con el número ("3 elementos eliminados"). */
  done: (count: number) => string
  /** Infinitivo del verbo para los fallos ("eliminar", "mover"). */
  verb: string
}

export type BulkOutcome = { ok: boolean; message: string }

/**
 * Un único mensaje para todo el lote (§6.11: nada de un toast por elemento).
 * En fallo parcial nombra el primer error con su causa real — suele repetirse
 * (ej. varias carpetas no vacías) — y cuenta los demás.
 */
export function describeBulkOutcome<T extends { name: string }>(
  result: BulkResult<T>,
  labels: OutcomeLabels,
  messageOf: (error: unknown) => string,
): BulkOutcome {
  const { succeeded, failed } = result
  if (failed.length === 0) return { ok: true, message: labels.done(succeeded.length) }

  const first = failed[0]
  const reason = `"${first.item.name}": ${messageOf(first.error)}`
  const rest = failed.length > 1 ? ` (y ${failed.length - 1} más)` : ''
  if (succeeded.length === 0) {
    return {
      ok: false,
      message:
        failed.length === 1
          ? `No se pudo ${labels.verb} ${reason}`
          : `No se pudieron ${labels.verb} ${failed.length} elementos — ${reason}${rest}`,
    }
  }
  return {
    ok: false,
    message: `${labels.done(succeeded.length)}, pero ${
      failed.length === 1 ? '1 no se pudo' : `${failed.length} no se pudieron`
    } ${labels.verb} — ${reason}${rest}`,
  }
}

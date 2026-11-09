import { uploadKindOf, type UploadKind } from './directUpload'
import type { UploadQueueEntry } from './types'

// CLAUDE.md §7.4: qué entradas en cola arrancan. Lógica sin React (§9). Antes era un
// único tope («2 archivos a la vez») para todo; ahora hay uno por tipo de subida,
// porque no cuestan lo mismo: un archivo grande reparte sus chunks entre varios
// workers y ocupa la conexión mucho rato, mientras que uno pequeño es UNA petición
// cuyo tiempo es sobre todo ida y vuelta, y con solo 2 en vuelo dejaba huecos del
// semáforo global de peticiones sin usar.

export type UploadLimits = Record<UploadKind, number>

/**
 * Entradas que hay que arrancar ahora, en orden de cola. Respeta el tope de cada tipo
 * contando las que ya están `uploading`, y NO deja que un tipo bloquee al otro: un
 * archivo grande esperando hueco no retiene a los pequeños de detrás, ni al revés
 * (FIFO dentro de cada tipo, no global). `startedIds` son las ya lanzadas (una entrada
 * `queued` que se reintenta se quita de ahí para volver a poder arrancar).
 */
export function pickEntriesToStart(
  entries: readonly UploadQueueEntry[],
  startedIds: ReadonlySet<string>,
  limits: UploadLimits,
): UploadQueueEntry[] {
  const running: Record<UploadKind, number> = { direct: 0, chunked: 0 }
  for (const entry of entries) {
    if (entry.status === 'uploading') running[uploadKindOf(entry.file.size)] += 1
  }

  const toStart: UploadQueueEntry[] = []
  for (const entry of entries) {
    if (entry.status !== 'queued' || startedIds.has(entry.id)) continue
    const kind = uploadKindOf(entry.file.size)
    if (running[kind] >= limits[kind]) continue
    running[kind] += 1
    toStart.push(entry)
  }
  return toStart
}

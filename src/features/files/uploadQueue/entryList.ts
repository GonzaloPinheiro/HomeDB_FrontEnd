import type { UploadEntryStatus, UploadQueueEntry } from './types'

// CLAUDE.md §6.4/§7.4: qué filas pinta el panel de subidas y cuántas hay de cada
// estado. Lógica sin React (§9). Existe porque el panel pintaba TODAS las filas:
// con cientos de archivos (una carpeta grande, §7.4) cada tick de progreso
// re-renderizaba cientos de nodos del DOM.

/**
 * Por encima de este nº de entradas, el panel oculta por defecto las completadas
 * (siguen contando en el resumen y se pueden mostrar). Con menos se ven todas, como
 * siempre: tres archivos subidos no deben desaparecer de la lista al terminar.
 */
export const COLLAPSE_DONE_THRESHOLD = 20

/** Tope de filas en el DOM. El resto sigue subiendo y contando en el resumen. */
export const MAX_RENDERED_ENTRIES = 100

export type EntrySummary = {
  total: number
  queued: number
  uploading: number
  processing: number
  done: number
  error: number
  cancelled: number
}

/** Recuento por estado en UNA pasada (antes eran varios `filter` por render y por consumidor). */
export function summarizeEntries(entries: readonly UploadQueueEntry[]): EntrySummary {
  const summary: EntrySummary = {
    total: entries.length,
    queued: 0,
    uploading: 0,
    processing: 0,
    done: 0,
    error: 0,
    cancelled: 0,
  }
  for (const entry of entries) summary[entry.status] += 1
  return summary
}

/** ¿El panel puede ocultar las completadas con esta cantidad de entradas? */
export function canCollapseDone(totalEntries: number): boolean {
  return totalEntries > COLLAPSE_DONE_THRESHOLD
}

// Qué se prefiere MOSTRAR cuando no caben todas: lo que exige acción (error) y lo
// que está pasando ahora, antes que lo que solo espera. Un número menor = más prioridad.
const DISPLAY_PRIORITY: Record<UploadEntryStatus, number> = {
  error: 0,
  uploading: 1,
  processing: 1,
  cancelled: 2,
  queued: 3,
  done: 4,
}

export type EntryListView = {
  /** Filas a pintar, SIEMPRE en el orden en que se encolaron. */
  rows: UploadQueueEntry[]
  /** Completadas que no se pintan porque el panel las oculta. */
  hiddenDone: number
  /** Entradas que habría que pintar pero no caben en `limit`. */
  hiddenOverflow: number
}

/**
 * Filas del panel. `showDone: false` quita las completadas; si aun así hay más de
 * `limit`, se eligen las más relevantes (`DISPLAY_PRIORITY`) pero se pintan en el
 * orden de la cola: reordenar por estado movería las filas bajo el cursor (el botón
 * "cancelar" que se iba a pulsar pasaría a ser el de otro archivo).
 */
export function buildEntryList(
  entries: readonly UploadQueueEntry[],
  { showDone, limit = MAX_RENDERED_ENTRIES }: { showDone: boolean; limit?: number },
): EntryListView {
  const candidates = showDone ? [...entries] : entries.filter((entry) => entry.status !== 'done')
  const hiddenDone = entries.length - candidates.length

  if (candidates.length <= limit) {
    return { rows: candidates, hiddenDone, hiddenOverflow: 0 }
  }

  // Array.prototype.sort es estable: dentro de una misma prioridad se conserva el orden de la cola.
  const chosen = new Set(
    [...candidates]
      .sort((a, b) => DISPLAY_PRIORITY[a.status] - DISPLAY_PRIORITY[b.status])
      .slice(0, limit)
      .map((entry) => entry.id),
  )
  return {
    rows: candidates.filter((entry) => chosen.has(entry.id)),
    hiddenDone,
    hiddenOverflow: candidates.length - limit,
  }
}

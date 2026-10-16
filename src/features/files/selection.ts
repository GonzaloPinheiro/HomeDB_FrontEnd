import type { ExplorerItem } from './types'

// CLAUDE.md §6.3: lógica pura de la selección múltiple del explorador (sin React,
// testeable — §9). La selección es un conjunto de claves `tipo-id`: un archivo y
// una carpeta pueden compartir id numérico, así que el id solo no basta.
export type SelectionKey = string

export function itemKey(item: Pick<ExplorerItem, 'kind' | 'id'>): SelectionKey {
  return `${item.kind}-${item.id}`
}

/** Añade la clave si no estaba, la quita si sí. Devuelve un conjunto nuevo (inmutable). */
export function toggleKey(selected: ReadonlySet<SelectionKey>, key: SelectionKey): Set<SelectionKey> {
  const next = new Set(selected)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

/**
 * Shift+clic: añade a la selección todo lo que hay entre `anchorKey` (el último
 * elemento marcado a mano) y `targetKey`, en el orden VISIBLE de la lista
 * (`orderedKeys`) — con otro criterio de orden el rango sería otro. Suma a lo
 * ya seleccionado, no lo reemplaza. Sin ancla válida solo añade el destino.
 */
export function addRange(
  selected: ReadonlySet<SelectionKey>,
  orderedKeys: readonly SelectionKey[],
  anchorKey: SelectionKey | null,
  targetKey: SelectionKey,
): Set<SelectionKey> {
  const next = new Set(selected)
  const targetIndex = orderedKeys.indexOf(targetKey)
  const anchorIndex = anchorKey === null ? -1 : orderedKeys.indexOf(anchorKey)
  if (targetIndex < 0 || anchorIndex < 0) {
    next.add(targetKey)
    return next
  }
  const [from, to] = anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex]
  for (const key of orderedKeys.slice(from, to + 1)) next.add(key)
  return next
}

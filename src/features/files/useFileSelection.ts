import { useCallback, useMemo, useState } from 'react'

import { addRange, itemKey, toggleKey, type SelectionKey } from './selection'
import type { ExplorerItem } from './types'

const EMPTY: ReadonlySet<SelectionKey> = new Set()

type State = { folderId: number | null; keys: ReadonlySet<SelectionKey>; anchor: SelectionKey | null }

// CLAUDE.md §6.3: estado de la selección múltiple. Reglas que importan:
// - Se acota a la carpeta: al navegar a otra, la selección se reinicia (patrón
//   de React de "ajustar estado cuando cambia una prop", durante el render y sin
//   efecto). Si solo se IGNORARA la selección de otra carpeta, al volver a la
//   anterior reaparecería.
// - `selectedItems` sale de la lista VISIBLE: lo que oculta el buscador, ha
//   desaparecido tras una acción o ya no existe nunca se opera por error, y la
//   cuenta de la barra coincide siempre con lo que se ve.
export function useFileSelection(folderId: number | null, visibleItems: readonly ExplorerItem[]) {
  const [state, setState] = useState<State>({ folderId, keys: EMPTY, anchor: null })

  if (state.folderId !== folderId) {
    setState({ folderId, keys: EMPTY, anchor: null })
  }
  // En el render de transición (antes de que se aplique el reinicio) se ve vacío.
  const keys = state.folderId === folderId ? state.keys : EMPTY

  const visibleKeys = useMemo(() => visibleItems.map(itemKey), [visibleItems])
  const selectedItems = useMemo(
    () => visibleItems.filter((item) => keys.has(itemKey(item))),
    [visibleItems, keys],
  )

  const update = useCallback(
    (change: (current: Omit<State, 'folderId'>) => Omit<State, 'folderId'>) => {
      setState((previous) => ({ folderId, ...change(previous.folderId === folderId ? previous : { keys: EMPTY, anchor: null }) }))
    },
    [folderId],
  )

  const isSelected = useCallback((item: ExplorerItem) => keys.has(itemKey(item)), [keys])

  const toggle = useCallback(
    (item: ExplorerItem) => {
      const key = itemKey(item)
      update((current) => ({ keys: toggleKey(current.keys, key), anchor: key }))
    },
    [update],
  )

  /** Clic con Shift: rango desde el último marcado. Sin Shift: alterna ese elemento. */
  const select = useCallback(
    (item: ExplorerItem, modifiers: { shift: boolean }) => {
      const key = itemKey(item)
      update((current) =>
        modifiers.shift
          ? { keys: addRange(current.keys, visibleKeys, current.anchor, key), anchor: current.anchor ?? key }
          : { keys: toggleKey(current.keys, key), anchor: key },
      )
    },
    [update, visibleKeys],
  )

  const selectAll = useCallback(() => {
    update(() => ({ keys: new Set(visibleKeys), anchor: null }))
  }, [update, visibleKeys])

  const clear = useCallback(() => {
    update(() => ({ keys: EMPTY, anchor: null }))
  }, [update])

  const count = selectedItems.length
  const allSelected = visibleItems.length > 0 && count === visibleItems.length

  /** Casilla de cabecera: selecciona todo lo visible, o vacía si ya estaba todo marcado. */
  const toggleAll = useCallback(() => {
    if (allSelected) clear()
    else selectAll()
  }, [allSelected, clear, selectAll])

  return { selectedItems, count, allSelected, isSelected, toggle, select, selectAll, toggleAll, clear }
}

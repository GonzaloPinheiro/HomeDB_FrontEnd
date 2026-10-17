import { useCallback, useMemo, useState } from 'react'

import type { ExplorerItem } from '../types'
import { isViewableFile, type FileExplorerItem } from './media'

// CLAUDE.md §6.3c: estado del visor. Guarda solo el id del archivo abierto y deduce
// el resto de la lista VISIBLE del explorador (con su orden y su filtro de
// búsqueda): anterior/siguiente recorren exactamente lo que el usuario ve, solo
// imágenes y vídeos. Así no hay una copia de la lista que se quede desfasada.
export function useMediaViewer(visibleItems: readonly ExplorerItem[]) {
  const [itemId, setItemId] = useState<number | null>(null)

  const items = useMemo<FileExplorerItem[]>(() => visibleItems.filter(isViewableFile), [visibleItems])
  const index = itemId === null ? -1 : items.findIndex((item) => item.id === itemId)

  // Si el archivo abierto desaparece de la lista (se borró o movió desde otra
  // pestaña, se cambió de carpeta con atrás/adelante…) el visor se cierra Y se
  // olvida el id: si no, volvería a abrirse solo si el archivo reapareciera tras
  // un refetch. Patrón de React de "ajustar estado durante el render" (como
  // useFileSelection), sin efecto.
  if (itemId !== null && index < 0) {
    setItemId(null)
  }

  const open = useCallback((item: ExplorerItem) => setItemId(item.id), [])
  const close = useCallback(() => setItemId(null), [])
  const goTo = useCallback(
    (target: number) => {
      const next = items[target]
      if (next) setItemId(next.id)
    },
    [items],
  )

  return { items, index, isOpen: index >= 0, open, close, goTo }
}

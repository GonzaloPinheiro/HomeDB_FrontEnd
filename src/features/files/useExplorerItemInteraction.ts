import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useCallback, type KeyboardEvent, type MouseEvent } from 'react'

import type { ExplorerItem } from './types'

type Options = {
  item: ExplorerItem
  onEnterFolder: (item: ExplorerItem) => void
  /** Alterna la selección de este elemento; con Shift, rango desde el último marcado. */
  onSelect: (item: ExplorerItem, modifiers: { shift: boolean }) => void
}

// CLAUDE.md §6.3/§7.5: interacción común de un elemento del explorador, sea cual
// sea el modo de visualización (fila de lista o tarjeta de miniatura, §6.3b) —
// así el arrastre, la selección y "entrar en la carpeta" no se duplican ni
// pueden divergir entre modos.
// - Archivos arrastrables, carpetas destino (dnd-kit, sensores de puntero).
// - Ctrl/Cmd+clic y Shift+clic seleccionan en vez de entrar en la carpeta.
// - Clic o Enter/Espacio sobre una carpeta entran en ella.
export function useExplorerItemInteraction({ item, onEnterFolder, onSelect }: Options) {
  const isFolder = item.kind === 'folder'

  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({
    id: `file-${item.id}`,
    disabled: isFolder, // solo archivos se arrastran en esta fase (carpetas: Fase futura)
    data: { item },
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `folder-${item.id}`,
    disabled: !isFolder,
    data: { type: 'folder', folderId: item.id },
  })

  const setNodeRef = useCallback(
    (element: HTMLDivElement | null) => {
      setDragRef(element)
      setDropRef(element)
    },
    [setDragRef, setDropRef],
  )

  const onClick = (event: MouseEvent) => {
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      event.preventDefault()
      onSelect(item, { shift: event.shiftKey })
      return
    }
    if (isFolder) onEnterFolder(item)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    // Solo si el foco está en el propio elemento: el teclado de los controles que
    // contiene (casilla, menú de acciones — cuyo contenido, aunque va en un portal,
    // propaga el evento por el árbol de React) no debe entrar en la carpeta.
    if (event.target !== event.currentTarget) return
    if (isFolder && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      onEnterFolder(item)
    }
  }

  return {
    isDragging,
    isOver,
    // Listeners/atributos de arrastre solo en archivos: una carpeta (draggable
    // deshabilitado) no debe heredar aria-disabled ni listeners inertes
    rowProps: {
      ref: setNodeRef,
      role: isFolder ? 'button' : undefined,
      tabIndex: isFolder ? 0 : undefined,
      onClick,
      onKeyDown,
      ...(isFolder ? {} : { ...listeners, ...attributes }),
    },
  }
}

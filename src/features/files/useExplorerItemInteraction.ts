import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useCallback, type KeyboardEvent, type MouseEvent } from 'react'

import type { ExplorerItem } from './types'
import { isViewableFile } from './viewer/media'

// Atributo con el que el visor localiza la fila/tarjeta de un archivo para devolverle el foco al cerrarse
export const ITEM_KEY_ATTRIBUTE = 'data-item-key'
export const itemFocusKey = (item: ExplorerItem): string => `${item.kind}-${item.id}`

type Options = {
  item: ExplorerItem
  onEnterFolder: (item: ExplorerItem) => void
  /** Abre el visor (§6.3c): solo se llama para imágenes y vídeos. */
  onOpen: (item: ExplorerItem) => void
  /** Alterna la selección de este elemento; con Shift, rango desde el último marcado. */
  onSelect: (item: ExplorerItem, modifiers: { shift: boolean }) => void
}

// CLAUDE.md §6.3/§7.5: interacción común de un elemento del explorador, sea cual
// sea el modo de visualización (fila de lista o tarjeta de miniatura, §6.3b) —
// así el arrastre, la selección y "entrar en la carpeta" no se duplican ni
// pueden divergir entre modos.
// - Archivos arrastrables, carpetas destino (dnd-kit, sensores de puntero).
// - Ctrl/Cmd+clic y Shift+clic seleccionan en vez de entrar en la carpeta.
// - Clic o Enter/Espacio sobre una carpeta entran en ella; sobre una imagen o un
//   vídeo abren el visor (§6.3c). Cualquier otro archivo no hace nada al activarse.
export function useExplorerItemInteraction({ item, onEnterFolder, onOpen, onSelect }: Options) {
  const isFolder = item.kind === 'folder'
  const isOpenable = isViewableFile(item)
  const activate = () => {
    if (isFolder) onEnterFolder(item)
    else if (isOpenable) onOpen(item)
  }

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
    activate()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    // Solo si el foco está en el propio elemento: el teclado de los controles que
    // contiene (casilla, menú de acciones — cuyo contenido, aunque va en un portal,
    // propaga el evento por el árbol de React) no debe entrar en la carpeta.
    if (event.target !== event.currentTarget) return
    if ((isFolder || isOpenable) && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      activate()
    }
  }

  // Listeners/atributos de arrastre solo en archivos: una carpeta (draggable
  // deshabilitado) no debe heredar aria-disabled ni listeners inertes. Se esparcen
  // ANTES de los manejadores propios y el teclado se encadena: con un sensor de
  // teclado de dnd-kit, sus `onKeyDown` pisarían al nuestro y un archivo dejaría
  // de abrirse con Enter (hoy solo hay PointerSensor, pero no debe depender de eso).
  const dragProps: Record<string, unknown> = isFolder ? {} : { ...listeners, ...attributes }
  const dragKeyDown = dragProps.onKeyDown as ((event: KeyboardEvent) => void) | undefined

  return {
    isDragging,
    isOver,
    /** Se activa con clic: carpetas (entrar) e imágenes/vídeos (visor). Para el cursor de mano. */
    isActivatable: isFolder || isOpenable,
    rowProps: {
      ...dragProps,
      // Para devolverle el foco al cerrar el visor (§6.3c, ver itemKey en MediaViewer)
      [ITEM_KEY_ATTRIBUTE]: itemFocusKey(item),
      ...(isFolder ? { role: 'button', tabIndex: 0 } : {}),
      ref: setNodeRef,
      onClick,
      onKeyDown: (event: KeyboardEvent) => {
        dragKeyDown?.(event)
        onKeyDown(event)
      },
    },
  }
}

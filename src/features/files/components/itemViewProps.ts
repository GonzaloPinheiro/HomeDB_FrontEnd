import type { ExplorerItem } from '../types'

// Props comunes de FileRow (lista) y FileCard (miniaturas, §6.3b): el explorador
// elige uno u otro según el modo, así que ambos reciben exactamente lo mismo.
export type ExplorerItemViewProps = {
  item: ExplorerItem
  onEnterFolder: (item: ExplorerItem) => void
  onOpen: (item: ExplorerItem) => void
  onDownload: (item: ExplorerItem) => void
  onRename: (item: ExplorerItem) => void
  onMove: (item: ExplorerItem) => void
  onDelete: (item: ExplorerItem) => void
  selected: boolean
  /** Hay algo seleccionado en la lista: las casillas de TODOS los elementos pasan a verse. */
  selectionActive: boolean
  /** Alterna la selección de este elemento; con Shift, rango desde el último marcado. */
  onSelect: (item: ExplorerItem, modifiers: { shift: boolean }) => void
}

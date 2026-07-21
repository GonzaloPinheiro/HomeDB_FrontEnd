import type { ExplorerItem } from './types'

export type SortKey = 'name' | 'size' | 'date'
export type SortDirection = 'asc' | 'desc'

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })

function byName(a: ExplorerItem, b: ExplorerItem): number {
  return collator.compare(a.name, b.name)
}

function byDate(a: ExplorerItem, b: ExplorerItem): number {
  return a.createdAt.localeCompare(b.createdAt)
}

/**
 * CLAUDE.md §6.3: carpetas siempre primero, sin importar el criterio activo.
 * Nombre y Fecha ordenan todo; Tamaño solo reordena archivos (las carpetas no
 * tienen tamaño en el contrato actual y mantienen orden fijo por nombre).
 * Orden hecho en cliente: el backend no admite parámetros de orden (verificado).
 */
export function sortExplorerItems(
  items: ExplorerItem[],
  key: SortKey,
  direction: SortDirection,
): ExplorerItem[] {
  const sign = direction === 'asc' ? 1 : -1
  const folders = items.filter((item) => item.kind === 'folder')
  const files = items.filter((item) => item.kind === 'file')

  if (key === 'size') {
    // Tamaño no reordena carpetas: quedan en orden fijo por nombre ascendente
    folders.sort(byName)
    files.sort((a, b) => {
      if (a.kind !== 'file' || b.kind !== 'file') return 0
      return sign * (a.sizeBytes - b.sizeBytes)
    })
  } else {
    const compare = key === 'name' ? byName : byDate
    folders.sort((a, b) => sign * compare(a, b))
    files.sort((a, b) => sign * compare(a, b))
  }

  return [...folders, ...files]
}

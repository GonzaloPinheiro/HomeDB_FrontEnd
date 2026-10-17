// CLAUDE.md §6.3b: modo de visualización del explorador de archivos. Como la
// preferencia de tema (§6.1), se guarda solo en el dispositivo (localStorage) —
// no hay campo en el backend y no hace falta sincronizarlo entre dispositivos.

export type ViewMode = 'list' | 'grid'

export const VIEW_MODE_KEY = 'files.viewMode'
export const DEFAULT_VIEW_MODE: ViewMode = 'list'

/** Cualquier valor que no sea exactamente 'grid' (ausente, corrupto, de otra versión) es la lista. */
export function parseViewMode(value: unknown): ViewMode {
  return value === 'grid' ? 'grid' : DEFAULT_VIEW_MODE
}

// localStorage puede lanzar (ventana privada, datos de sitio bloqueados, SecurityError)
// o no existir: en ambos casos el explorador funciona igual, solo que no recuerda el modo.
export function readStoredViewMode(): ViewMode {
  try {
    return parseViewMode(localStorage.getItem(VIEW_MODE_KEY))
  } catch {
    return DEFAULT_VIEW_MODE
  }
}

export function storeViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode)
  } catch {
    // Sin almacenamiento disponible: el modo solo dura lo que la pestaña.
  }
}

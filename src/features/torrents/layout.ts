// CLAUDE.md §6.19: breakpoints de Tailwind por defecto (`lg` 1024px, `xl` 1280px)
// como media queries, para las decisiones de layout que se toman en JS. Si se
// tocan los `screens` de tailwind.config.ts, tocar también estas dos.
export const LG_QUERY = '(min-width: 1024px)'
export const XL_QUERY = '(min-width: 1280px)'

export type ListLayout = 'wide' | 'compact'

type LayoutInput = {
  /** Hay un torrent seleccionado y por tanto el panel de ficheros ocupa sitio. */
  panelOpen: boolean
  isLg: boolean
  isXl: boolean
}

/**
 * CLAUDE.md §6.19: `wide` = tabla de columnas; `compact` = cada torrent como una
 * tarjeta apilada. La tabla necesita ~700px de lista: a partir de `lg` si la
 * lista tiene todo el ancho, pero con el panel de ficheros al lado (340px) solo
 * cabe desde `xl`. Por debajo de `lg` siempre es `compact` (y con un torrent
 * seleccionado la lista ni se muestra: la sustituye el panel).
 */
export function resolveListLayout({ panelOpen, isLg, isXl }: LayoutInput): ListLayout {
  if (panelOpen) return isXl ? 'wide' : 'compact'
  return isLg ? 'wide' : 'compact'
}

/** Id del panel de ficheros: lo enlazan las filas con `aria-controls`. */
export const FILES_PANEL_ID = 'torrent-files-panel'

/**
 * Columnas del layout `wide`, compartidas por la cabecera y cada fila para que
 * queden alineadas: casilla | nombre | estado | progreso | acciones.
 */
export const WIDE_ROW_GRID = 'grid grid-cols-[1.25rem_minmax(0,1fr)_9rem_10rem_5rem] items-center gap-3'

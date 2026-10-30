import type { MouseEvent } from 'react'

import { SelectCheckbox } from '@/shared/components/SelectCheckbox'
import { formatBytes } from '@/shared/lib/formatBytes'
import { cn } from '@/shared/lib/utils'

import { FILES_PANEL_ID, WIDE_ROW_GRID, type ListLayout } from '../layout'
import { CATEGORY_LABELS } from '../labels'
import type { Torrent } from '../types'
import { TorrentProgress } from './TorrentProgress'
import { TorrentRowActions } from './TorrentRowActions'
import { TorrentStatusBadge } from './TorrentStatusBadge'

// Atributo con el que la pantalla localiza el botón de un torrent para devolverle el foco al cerrar el panel
export const TORRENT_TRIGGER_ATTRIBUTE = 'data-torrent-trigger'

// Controles que viven dentro de la fila: un clic en ellos no debe abrir el detalle.
// `menuitem` porque el contenido del menú de acciones va en un portal pero propaga
// el evento por el árbol de React hasta la fila (mismo motivo que ItemActionsMenu).
const INTERACTIVE_SELECTOR = 'button, a, input, [role="menuitem"], [role="checkbox"]'

type TorrentRowProps = {
  torrent: Torrent
  layout: ListLayout
  selected: boolean
  onSelect: (id: number) => void
}

function TorrentIdentity({ torrent, layout, selected, onSelect }: TorrentRowProps) {
  const compact = layout === 'compact'
  return (
    <div className="min-w-0">
      {/* El botón del nombre es el control accesible de la fila: Tab llega a él y
          Enter/Espacio abren el panel. El resto de la fila es solo comodidad con ratón. */}
      <button
        type="button"
        {...{ [TORRENT_TRIGGER_ATTRIBUTE]: torrent.id }}
        aria-expanded={selected}
        aria-controls={selected ? FILES_PANEL_ID : undefined}
        title={torrent.name}
        onClick={() => onSelect(torrent.id)}
        className={cn(
          // En compacto el nombre puede ocupar dos líneas (hay poco ancho y es lo que identifica la fila)
          'w-full rounded text-left text-sm font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          compact ? 'line-clamp-2 break-words' : 'block truncate',
        )}
      >
        {torrent.name}
      </button>
      <div className={cn('mt-1 flex min-w-0 items-center gap-2 text-xs text-text-muted', compact && 'flex-wrap gap-y-1')}>
        <span className="shrink-0 rounded-md border border-border-light bg-surface px-2 py-0.5 text-[11px] font-medium text-text-secondary">
          {CATEGORY_LABELS[torrent.category]}
        </span>
        <span className="shrink-0">{formatBytes(torrent.sizeBytes)}</span>
        {torrent.pendingImport && (
          <span className={cn('min-w-0', !compact && 'truncate')}>
            · Se importará a {CATEGORY_LABELS[torrent.category]} al terminar
          </span>
        )}
      </div>
    </div>
  )
}

// CLAUDE.md §6.19: una fila, dos disposiciones. `wide` = columnas de tabla;
// `compact` = tarjeta apilada para móvil y para cuando el panel de ficheros le
// quita ancho a la lista. Las piezas (identidad, estado, progreso, acciones) son
// las mismas: solo cambia cómo se reparten.
export function TorrentRow({ torrent, layout, selected, onSelect }: TorrentRowProps) {
  const handleRowClick = (event: MouseEvent<HTMLLIElement>) => {
    if ((event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return
    onSelect(torrent.id)
  }

  // PENDIENTE (CLAUDE.md §6.19): la casilla es solo visual — la selección múltiple
  // (acciones por lote) llegará con el backend, como en Archivos (§6.3, bulk.ts).
  const checkbox = <SelectCheckbox checked={false} onToggle={() => undefined} label={`Seleccionar ${torrent.name}`} />

  return (
    <li
      onClick={handleRowClick}
      className={cn(
        'group cursor-pointer rounded-lg px-3 py-2.5 transition-colors hover:bg-row-hover',
        selected && 'bg-accent-tint-bg hover:bg-accent-tint-bg',
      )}
    >
      {layout === 'wide' ? (
        <div className={WIDE_ROW_GRID}>
          {checkbox}
          <TorrentIdentity torrent={torrent} layout={layout} selected={selected} onSelect={onSelect} />
          <TorrentStatusBadge status={torrent.status} />
          <TorrentProgress torrent={torrent} />
          <TorrentRowActions torrent={torrent} selected={selected} />
        </div>
      ) : (
        <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2.5">
          <div className="pt-0.5">{checkbox}</div>
          <TorrentIdentity torrent={torrent} layout={layout} selected={selected} onSelect={onSelect} />
          <TorrentRowActions torrent={torrent} selected={selected} />
          <div className="col-span-2 col-start-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* Ancho fijo (el del badge más largo, «Contenido borrado») para que las barras de todas las filas empiecen alineadas */}
            <div className="w-[8.75rem] shrink-0">
              <TorrentStatusBadge status={torrent.status} />
            </div>
            <TorrentProgress torrent={torrent} className="min-w-[10rem] flex-1" />
          </div>
        </div>
      )}
    </li>
  )
}

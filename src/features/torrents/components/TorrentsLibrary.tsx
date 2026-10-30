import { useEffect, useRef, type KeyboardEvent } from 'react'

import { useMediaQuery } from '@/shared/hooks/useMediaQuery'
import { cn } from '@/shared/lib/utils'

import { useTorrents } from '../api'
import { LG_QUERY, XL_QUERY, resolveListLayout } from '../layout'
import { countByCategory } from '../presentation'
import { useSelectedTorrent } from '../useSelectedTorrent'
import { TorrentFilesPanel } from './TorrentFilesPanel'
import { TorrentList } from './TorrentList'
import { TORRENT_TRIGGER_ATTRIBUTE } from './TorrentRow'
import { TorrentsHeader } from './TorrentsHeader'
import { TorrentsToolbar } from './TorrentsToolbar'

// CLAUDE.md §6.19: pantalla de la biblioteca de torrents. Lista a la izquierda y,
// al seleccionar un torrent, panel de ficheros a la derecha (340px). Por debajo de
// `lg` no hay sitio para los dos: el panel SUSTITUYE a la lista (y a la cabecera y
// los filtros, que no pintan nada mientras se ven los ficheros) y se vuelve con el
// botón del panel, con Esc o con «atrás» del navegador (el torrent abierto vive en
// la URL, `useSelectedTorrent`).
export function TorrentsLibrary() {
  const torrents = useTorrents()
  const { selectedId, select, clear } = useSelectedTorrent()
  const isLg = useMediaQuery(LG_QUERY)
  const isXl = useMediaQuery(XL_QUERY)

  // Un id de la URL que no existe (enlace viejo, torrent ya eliminado) = sin selección
  const selected = selectedId === null ? null : (torrents.data?.find((torrent) => torrent.id === selectedId) ?? null)
  const panelOpen = selected !== null
  const replacesList = panelOpen && !isLg
  const layout = resolveListLayout({ panelOpen, isLg, isXl })

  // §11: al cerrar el panel, el foco vuelve al torrent que se estaba viendo
  const previousSelectedId = useRef<number | null>(null)
  const selectedIdForFocus = selected?.id ?? null
  useEffect(() => {
    const closedId = previousSelectedId.current
    previousSelectedId.current = selectedIdForFocus
    if (selectedIdForFocus === null && closedId !== null) {
      document.querySelector<HTMLElement>(`[${TORRENT_TRIGGER_ATTRIBUTE}="${closedId}"]`)?.focus()
    }
  }, [selectedIdForFocus])

  // Esc cierra el panel, salvo que lo haya consumido un menú o diálogo abierto
  // (Radix cancela el evento al cerrarse: `defaultPrevented`)
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !event.defaultPrevented && panelOpen) clear()
  }

  const data = torrents.data

  return (
    <div
      onKeyDown={handleKeyDown}
      className="flex min-h-full flex-col gap-[22px] px-4 py-6 sm:px-8 sm:py-[26px]"
    >
      <div className={cn('flex flex-col gap-[22px]', replacesList && 'hidden')}>
        <TorrentsHeader />
        <TorrentsToolbar
          counts={data ? countByCategory(data) : undefined}
          total={data?.length}
          // PENDIENTE (CLAUDE.md §6.19): filtro fijo en "Todas" hasta que haya backend
          active="all"
        />
      </div>

      {/* minmax(0,1fr) también en la columna única: sin él la pista del grid crece con el
          contenido (nombres largos, rutas) y desborda la pantalla en móvil */}
      <div className={cn('grid grid-cols-[minmax(0,1fr)] items-start gap-5', panelOpen && 'lg:grid-cols-[minmax(0,1fr)_340px]')}>
        <TorrentList
          query={torrents}
          layout={layout}
          selectedId={selected?.id ?? null}
          onSelect={select}
          className={cn(replacesList && 'hidden')}
        />
        {selected && <TorrentFilesPanel torrent={selected} onClose={clear} moveFocusOnOpen={replacesList} />}
      </div>
    </div>
  )
}

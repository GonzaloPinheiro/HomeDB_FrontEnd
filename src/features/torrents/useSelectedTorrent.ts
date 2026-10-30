import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

const PARAM = 'torrent'

/** `?torrent=3` -> 3. Cualquier cosa que no sea un id entero positivo es "ninguno". */
export function parseTorrentId(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

// CLAUDE.md §6.19/§7.10: el torrent abierto vive en la URL (`?torrent=<id>`), no
// en estado de componente — sobrevive a un refresco, se puede compartir y, sobre
// todo en móvil (donde el panel de ficheros sustituye a la lista), el botón
// «atrás» del navegador lo cierra en vez de sacar al usuario de la pantalla.
// Abrir el primero añade una entrada al historial; cambiar de torrent o cerrar la
// sustituyen, para que «atrás» no recorra cada fila que se ha mirado.
export function useSelectedTorrent() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = parseTorrentId(searchParams.get(PARAM))

  const select = useCallback(
    (id: number) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          next.set(PARAM, String(id))
          return next
        },
        { replace: selectedId !== null },
      )
    },
    [setSearchParams, selectedId],
  )

  const clear = useCallback(() => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.delete(PARAM)
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  return { selectedId, select, clear }
}

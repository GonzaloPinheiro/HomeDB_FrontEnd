import { useCallback } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { DEFAULT_SETTINGS_SECTION, parseSettingsSection, type SettingsSection } from './sections'

const PARAM = 'settings'

// Marca en el `state` de la entrada de historial que ABRIÓ el modal desde la app, para
// saber al cerrar si basta con volver atrás (queda el historial como estaba) o si se
// llegó con un enlace directo (no hay nada a donde volver: se quita el parámetro).
type OpenedHere = { settingsOpenedHere?: boolean } | null

// CLAUDE.md §6.20/§7.10: la sección abierta de los ajustes vive en la URL
// (`?settings=<sección>`), no en estado de componente — sobrevive a un refresco, se puede
// enlazar y «atrás» cierra el modal en vez de sacar al usuario de la pantalla. Se
// conservan el resto de parámetros (`?folderId=…`, `?torrent=…`): se abre SOBRE cualquier
// pantalla sin moverla de sitio.
export function useSettingsModal() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const section = parseSettingsSection(searchParams.get(PARAM))
  const openedHere = (location.state as OpenedHere)?.settingsOpenedHere === true

  const open = useCallback(
    (target: SettingsSection = DEFAULT_SETTINGS_SECTION) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          next.set(PARAM, target)
          return next
        },
        // Abrir añade una entrada al historial; si ya estaba abierto solo cambia de sección.
        { replace: section !== null, state: { settingsOpenedHere: true } satisfies OpenedHere },
      )
    },
    [setSearchParams, section],
  )

  /** Cambia de sección con el modal ya abierto, sin añadir entradas al historial. */
  const select = useCallback(
    (target: SettingsSection) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          next.set(PARAM, target)
          return next
        },
        { replace: true, state: location.state },
      )
    },
    [setSearchParams, location.state],
  )

  const close = useCallback(() => {
    if (openedHere) {
      navigate(-1)
      return
    }
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.delete(PARAM)
        return next
      },
      { replace: true },
    )
  }, [openedHere, navigate, setSearchParams])

  return { section, open, select, close }
}

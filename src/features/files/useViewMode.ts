import { useCallback, useState } from 'react'

import { readStoredViewMode, storeViewMode, type ViewMode } from './viewMode'

/** Modo de visualización del explorador (§6.3b), recordado entre visitas en este dispositivo. */
export function useViewMode(): readonly [ViewMode, (mode: ViewMode) => void] {
  const [viewMode, setViewModeState] = useState<ViewMode>(readStoredViewMode)

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode)
    storeViewMode(mode)
  }, [])

  return [viewMode, setViewMode] as const
}

import { createContext, useContext, useEffect } from 'react'

import type { SettingsSection } from './sections'

// CLAUDE.md §6.20/§11: cada sección con formulario avisa al modal de si tiene cambios sin
// guardar, para pedir confirmación antes de cerrarlo y marcar la sección en la navegación.
// Las secciones visitadas siguen montadas, así que cambiar de sección NO pierde lo escrito.

type DirtyContextValue = {
  setDirty: (section: SettingsSection, dirty: boolean) => void
}

const DirtyContext = createContext<DirtyContextValue>({ setDirty: () => {} })

export const SettingsDirtyProvider = DirtyContext.Provider

/** Publica si el formulario de `section` tiene cambios sin guardar; al desmontarse lo retira. */
export function useReportDirty(section: SettingsSection, isDirty: boolean): void {
  const { setDirty } = useContext(DirtyContext)
  useEffect(() => {
    setDirty(section, isDirty)
    return () => setDirty(section, false)
  }, [section, isDirty, setDirty])
}

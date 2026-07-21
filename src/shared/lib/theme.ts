// CLAUDE.md §6.1: prefers-color-scheme por defecto, con override manual guardado
// solo en el dispositivo (localStorage, clave 'theme'). Única implementación de
// la lógica de tema: main.tsx la aplica al arrancar y el selector de Ajustes
// (Fase 3) escribe exactamente en el mismo sitio.

const THEME_KEY = 'theme'

export type ThemePreference = 'light' | 'dark' | 'auto'

export function getThemePreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'auto'
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Aplica sobre <html> la clase `dark` que corresponda a la preferencia actual. */
export function applyTheme(): void {
  const preference = getThemePreference()
  const isDark = preference === 'auto' ? systemPrefersDark() : preference === 'dark'
  document.documentElement.classList.toggle('dark', isDark)
}

/**
 * Fija la preferencia y la aplica. 'auto' BORRA el override de localStorage
 * (vuelve a seguir prefers-color-scheme); 'light'/'dark' lo fijan.
 */
export function setThemePreference(preference: ThemePreference): void {
  if (preference === 'auto') {
    localStorage.removeItem(THEME_KEY)
  } else {
    localStorage.setItem(THEME_KEY, preference)
  }
  applyTheme()
}

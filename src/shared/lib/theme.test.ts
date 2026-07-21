import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyTheme, getThemePreference, setThemePreference } from './theme'

function stubSystemDark(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches }))
}

describe('tema (CLAUDE.md §6.1)', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    stubSystemDark(false)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('Claro/Oscuro escriben el override en localStorage y aplican la clase', () => {
    setThemePreference('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    setThemePreference('light')
    expect(localStorage.getItem('theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('Automático borra el override y vuelve a seguir prefers-color-scheme', () => {
    setThemePreference('dark')
    stubSystemDark(false)
    setThemePreference('auto')
    expect(localStorage.getItem('theme')).toBeNull()
    expect(getThemePreference()).toBe('auto')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    stubSystemDark(true)
    applyTheme()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('un valor corrupto en localStorage cuenta como auto', () => {
    localStorage.setItem('theme', 'fucsia')
    expect(getThemePreference()).toBe('auto')
  })
})

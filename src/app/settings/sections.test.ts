import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SETTINGS_SECTION,
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  parseSettingsSection,
} from './sections'

describe('SETTINGS_SECTIONS', () => {
  it('no repite ids ni etiquetas', () => {
    const ids = SETTINGS_SECTIONS.map((section) => section.id)
    const labels = SETTINGS_SECTIONS.map((section) => section.label)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('cada sección pertenece a un grupo que existe, y no hay grupos vacíos', () => {
    const groupIds = new Set(SETTINGS_GROUPS.map((group) => group.id))
    for (const section of SETTINGS_SECTIONS) expect(groupIds.has(section.group)).toBe(true)
    for (const group of SETTINGS_GROUPS) {
      expect(SETTINGS_SECTIONS.some((section) => section.group === group.id)).toBe(true)
    }
  })

  it('la sección por defecto existe', () => {
    expect(SETTINGS_SECTIONS.some((section) => section.id === DEFAULT_SETTINGS_SECTION)).toBe(true)
  })
})

describe('parseSettingsSection', () => {
  it('reconoce todas las secciones', () => {
    for (const section of SETTINGS_SECTIONS)
      expect(parseSettingsSection(section.id)).toBe(section.id)
  })

  it('cualquier otra cosa es "cerrado"', () => {
    expect(parseSettingsSection(null)).toBeNull()
    expect(parseSettingsSection('')).toBeNull()
    expect(parseSettingsSection('Profile')).toBeNull() // distingue mayúsculas
    expect(parseSettingsSection('desconocida')).toBeNull()
    expect(parseSettingsSection('profile ')).toBeNull()
    expect(parseSettingsSection('__proto__')).toBeNull()
  })
})

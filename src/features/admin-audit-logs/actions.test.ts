import { describe, expect, it } from 'vitest'

import {
  actionBadgeClass,
  actionCategory,
  actionLabel,
  actionSeverity,
  SENSITIVE_ACTIONS,
} from './actions'
import { AUDIT_ACTIONS } from './types'

describe('actionLabel', () => {
  it('toda acción conocida tiene una etiqueta legible distinta de su código', () => {
    for (const action of AUDIT_ACTIONS) {
      expect(actionLabel(action)).not.toBe(action)
    }
  })

  it('las etiquetas son únicas (en la tabla no se confunden dos acciones)', () => {
    const labels = AUDIT_ACTIONS.map(actionLabel)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('una acción desconocida se muestra tal cual', () => {
    expect(actionLabel('RESTORE_FILE')).toBe('RESTORE_FILE')
  })

  it('un nombre heredado de Object.prototype no cuenta como acción conocida', () => {
    expect(actionLabel('toString')).toBe('toString')
    expect(actionSeverity('constructor')).toBe('normal')
    expect(actionCategory('toString')).toBeNull()
  })
})

describe('actionSeverity / SENSITIVE_ACTIONS', () => {
  it('las sensibles son altas, cambios de contraseña y borrado de usuarios', () => {
    expect([...SENSITIVE_ACTIONS].sort()).toEqual(['CHANGE_PASSWORD', 'DELETE_USER', 'REGISTER'])
  })

  it('borrar un usuario es destructivo; cambiar la contraseña, sensible; iniciar sesión, normal', () => {
    expect(actionSeverity('DELETE_USER')).toBe('destructive')
    expect(actionSeverity('CHANGE_PASSWORD')).toBe('sensitive')
    expect(actionSeverity('LOGIN')).toBe('normal')
  })

  it('borrar archivos o carpetas es lo habitual: no se señala', () => {
    expect(actionSeverity('DELETE_FILE')).toBe('normal')
    expect(actionSeverity('DELETE_FOLDER')).toBe('normal')
  })

  it('una acción desconocida es normal', () => {
    expect(actionSeverity('RESTORE_FILE')).toBe('normal')
  })
})

describe('actionBadgeClass', () => {
  it('cada gravedad lleva su pastilla con fondo propio', () => {
    expect(actionBadgeClass('sensitive')).toContain('warning-bg')
    expect(actionBadgeClass('destructive')).toContain('critical-bg')
    expect(actionBadgeClass('normal')).not.toMatch(/warning|critical/)
  })
})

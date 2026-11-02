import { describe, expect, it } from 'vitest'

import { EMPTY_AUDIT_FILTERS } from './api'
import {
  actionDrillDown,
  buildFilterChips,
  filteredUserName,
  sensitiveCaption,
  sensitiveTone,
  sensitiveTotal,
  userChipLabel,
  userDrillDown,
} from './presentation'

const items = (...counts: Array<[string, number | undefined]>) =>
  counts.map(([action, count]) => ({ action, count }))

describe('sensitiveTotal', () => {
  it('suma los recuentos', () => {
    expect(sensitiveTotal(items(['REGISTER', 2], ['CHANGE_PASSWORD', 1], ['DELETE_USER', 0]))).toBe(3)
  })

  it('si el recuento de alguna falló no se da una suma parcial', () => {
    expect(sensitiveTotal(items(['REGISTER', 2], ['CHANGE_PASSWORD', undefined]))).toBeUndefined()
  })

  it('sin acciones -> 0', () => {
    expect(sensitiveTotal([])).toBe(0)
  })
})

describe('sensitiveTone', () => {
  it('cero es verde, algo es ámbar y sin dato es neutro', () => {
    expect(sensitiveTone(0)).toBe('ok')
    expect(sensitiveTone(4)).toBe('warning')
    expect(sensitiveTone(undefined)).toBe('neutral')
  })
})

describe('sensitiveCaption', () => {
  it('sin ninguna, lo dice', () => {
    expect(sensitiveCaption(items(['REGISTER', 0], ['DELETE_USER', 0]))).toBe('Ninguna en este periodo')
  })

  it('lista solo las presentes, de mayor a menor, con la etiqueta en minúsculas', () => {
    expect(
      sensitiveCaption(items(['REGISTER', 1], ['CHANGE_PASSWORD', 3], ['DELETE_USER', 0])),
    ).toBe('3 × cambio de contraseña · 1 × alta de usuario')
  })

  it('ignora las que no tienen dato', () => {
    expect(sensitiveCaption(items(['REGISTER', undefined], ['CHANGE_PASSWORD', 2]))).toBe('2 × cambio de contraseña')
  })
})

describe('userChipLabel', () => {
  it('con nombre lo incluye; sin él, solo el id', () => {
    expect(userChipLabel(5, 'ana')).toBe('Usuario: ana (#5)')
    expect(userChipLabel(5, null)).toBe('Usuario #5')
    expect(userChipLabel(5, '')).toBe('Usuario #5')
  })
})

describe('buildFilterChips', () => {
  it('sin filtros no hay chips', () => {
    expect(buildFilterChips(EMPTY_AUDIT_FILTERS, null)).toEqual([])
  })

  it('la búsqueda por texto y la acción NO son chips: ya se ven en su propio control', () => {
    expect(buildFilterChips({ ...EMPTY_AUDIT_FILTERS, userName: 'ana', action: 'LOGIN' }, null)).toEqual([])
  })

  it('un chip por filtro oculto en el panel, en orden, y cada uno limpia solo lo suyo', () => {
    const chips = buildFilterChips(
      { userName: '', userId: 5, action: 'LOGIN', resourceType: 'FileItem', from: '2026-11-01', to: '2026-11-05' },
      'ana',
    )
    expect(chips.map((chip) => chip.label)).toEqual([
      'Usuario: ana (#5)',
      'Recurso: FileItem',
      'Desde 1 nov 2026',
      'Hasta 5 nov 2026',
    ])
    expect(chips.map((chip) => chip.clear)).toEqual([
      { userId: null },
      { resourceType: null },
      { from: null },
      { to: null },
    ])
  })
})

describe('drill-down', () => {
  it('pulsar un usuario filtra por su id exacto y vacía la búsqueda por texto', () => {
    expect(userDrillDown(7)).toEqual({ userId: 7, userName: '' })
  })

  it('pulsar una acción filtra solo por ella', () => {
    expect(actionDrillDown('DELETE_USER')).toEqual({ action: 'DELETE_USER' })
  })
})

describe('filteredUserName', () => {
  const rows = [
    { userId: 5, username: 'ana' },
    { userId: 9, username: 'luis' },
  ]

  it('saca el nombre del usuario filtrado de las filas cargadas', () => {
    expect(filteredUserName({ userId: 9 }, rows)).toBe('luis')
  })

  it('sin filtro de usuario, sin filas o sin coincidencia -> null', () => {
    expect(filteredUserName({ userId: null }, rows)).toBeNull()
    expect(filteredUserName({ userId: 5 }, undefined)).toBeNull()
    expect(filteredUserName({ userId: 5 }, [])).toBeNull()
    expect(filteredUserName({ userId: 3 }, rows)).toBeNull()
  })
})

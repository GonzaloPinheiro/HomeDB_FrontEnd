import { describe, expect, it } from 'vitest'

import {
  DEFAULT_FILTERS,
  countByStatus,
  filterByQueryAndOwner,
  filterByStatus,
  hasActiveFilters,
  normalizeSearch,
  sortDevices,
} from './filters'
import type { VpnDevice } from './types'

function device(overrides: Partial<VpnDevice>): VpnDevice {
  return {
    publicKey: overrides.name ?? 'k',
    name: 'Dispositivo',
    assignedIp: '10.6.0.2',
    isActive: false,
    lastHandshakeAt: null,
    endpoint: null,
    bytesReceived: 0,
    bytesSent: 0,
    ownerId: null,
    ownerName: null,
    notes: null,
    revocationRequestedAt: null,
    ...overrides,
  }
}

const ANA = device({ name: 'Móvil de Ana', assignedIp: '10.6.0.2', isActive: true, ownerId: 2, lastHandshakeAt: '2026-11-01T11:59:50Z', bytesReceived: 100, bytesSent: 50 })
const PORTATIL = device({ name: 'Portátil trabajo', assignedIp: '10.6.0.3', isActive: true, ownerId: 1, lastHandshakeAt: '2026-11-01T11:59:00Z', bytesReceived: 900, bytesSent: 100 })
const TABLET = device({ name: 'Tablet salón', assignedIp: '10.6.0.4', ownerId: null, lastHandshakeAt: '2026-10-29T10:00:00Z', bytesReceived: 40, bytesSent: 10 })
const ANTIGUO = device({ name: 'Móvil antiguo', assignedIp: '10.6.0.8', ownerId: 3, lastHandshakeAt: null })
const ALL = [ANA, PORTATIL, TABLET, ANTIGUO]

describe('búsqueda', () => {
  it('normalizeSearch quita tildes y mayúsculas', () => {
    expect(normalizeSearch('Móvil de ANA')).toBe('movil de ana')
  })

  it('encuentra por nombre sin importar tildes ni mayúsculas', () => {
    const found = filterByQueryAndOwner(ALL, { query: 'MOVIL', owner: 'all' })
    expect(found).toEqual([ANA, ANTIGUO])
  })

  it('encuentra por IP (coincidencia parcial)', () => {
    expect(filterByQueryAndOwner(ALL, { query: '10.6.0.3', owner: 'all' })).toEqual([PORTATIL])
    expect(filterByQueryAndOwner(ALL, { query: '10.6.0.', owner: 'all' })).toEqual(ALL)
  })

  it('una búsqueda vacía o de solo espacios no filtra', () => {
    expect(filterByQueryAndOwner(ALL, { query: '   ', owner: 'all' })).toEqual(ALL)
  })
})

describe('dueño', () => {
  it('filtra por el id del usuario', () => {
    expect(filterByQueryAndOwner(ALL, { query: '', owner: '2' })).toEqual([ANA])
  })

  it('"none" deja solo los dispositivos sin dueño', () => {
    expect(filterByQueryAndOwner(ALL, { query: '', owner: 'none' })).toEqual([TABLET])
  })

  it('se combina con la búsqueda', () => {
    expect(filterByQueryAndOwner(ALL, { query: 'movil', owner: '3' })).toEqual([ANTIGUO])
  })
})

describe('estado', () => {
  it('filterByStatus', () => {
    expect(filterByStatus(ALL, 'all')).toEqual(ALL)
    expect(filterByStatus(ALL, 'active')).toEqual([ANA, PORTATIL])
    expect(filterByStatus(ALL, 'inactive')).toEqual([TABLET, ANTIGUO])
  })

  it('filterByStatus no devuelve la misma referencia (no se puede mutar la lista de origen)', () => {
    expect(filterByStatus(ALL, 'all')).not.toBe(ALL)
  })

  it('countByStatus', () => {
    expect(countByStatus(ALL)).toEqual({ all: 4, active: 2, inactive: 2 })
    expect(countByStatus([])).toEqual({ all: 0, active: 0, inactive: 0 })
  })
})

describe('sortDevices', () => {
  it('por nombre, alfabético en español', () => {
    expect(sortDevices(ALL, 'name').map((d) => d.name)).toEqual(['Móvil antiguo', 'Móvil de Ana', 'Portátil trabajo', 'Tablet salón'])
  })

  it('por handshake, el más reciente primero y los que nunca se han conectado al final', () => {
    expect(sortDevices(ALL, 'handshake').map((d) => d.name)).toEqual(['Móvil de Ana', 'Portátil trabajo', 'Tablet salón', 'Móvil antiguo'])
  })

  it('por tráfico, el que más ha movido primero', () => {
    expect(sortDevices(ALL, 'traffic').map((d) => d.name)).toEqual(['Portátil trabajo', 'Móvil de Ana', 'Tablet salón', 'Móvil antiguo'])
  })

  it('no muta la entrada', () => {
    const before = ALL.slice()
    sortDevices(ALL, 'traffic')
    expect(ALL).toEqual(before)
  })
})

describe('hasActiveFilters', () => {
  it('detecta cualquier filtro distinto del de por defecto', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, query: 'ana' })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, query: '   ' })).toBe(false)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, status: 'active' })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, owner: 'none' })).toBe(true)
  })
})

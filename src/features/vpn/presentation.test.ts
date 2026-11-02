import { describe, expect, it } from 'vitest'

import {
  REVOCATION_OVERDUE_MS,
  SNAPSHOT_STALE_MS,
  describeSummary,
  findCompletedRevocations,
  formatAgo,
  formatHandshake,
  formatHandshakeAbsolute,
  formatShortKey,
  getDeviceStatus,
  getOwnerInitials,
  getRevocationAgeMs,
  getSnapshotAgeMs,
  isRevocationOverdue,
  isRevokeConfirmed,
  isSnapshotStale,
  summarizeDevices,
  withCurrentOwner,
} from './presentation'
import type { VpnDevice } from './types'

const NOW = Date.parse('2026-11-01T12:00:00Z')
const SECOND = 1000

function device(overrides: Partial<VpnDevice> = {}): VpnDevice {
  return {
    publicKey: 'key-1',
    name: 'Móvil de Ana',
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

describe('getDeviceStatus', () => {
  it('activo si el backend lo marca como tal', () => {
    expect(getDeviceStatus(device({ isActive: true, lastHandshakeAt: '2026-11-01T11:59:50Z' }))).toBe('active')
  })

  it('inactivo si se conectó alguna vez pero ya no; "nunca conectado" si no hay handshake', () => {
    expect(getDeviceStatus(device({ lastHandshakeAt: '2026-10-20T10:00:00Z' }))).toBe('inactive')
    expect(getDeviceStatus(device({ lastHandshakeAt: null }))).toBe('never')
  })

  it('una revocación pendiente manda sobre todo, incluso con handshake reciente', () => {
    const revoking = device({ isActive: true, lastHandshakeAt: '2026-11-01T11:59:50Z', revocationRequestedAt: '2026-11-01T11:59:00Z' })
    expect(getDeviceStatus(revoking)).toBe('revoking')
  })
})

describe('formatAgo / formatHandshake', () => {
  it('formatAgo por tramos', () => {
    expect(formatAgo(0)).toBe('hace 0 s')
    expect(formatAgo(8 * SECOND)).toBe('hace 8 s')
    expect(formatAgo(59_999)).toBe('hace 59 s')
    expect(formatAgo(60 * SECOND)).toBe('hace 1 min')
    expect(formatAgo(3599 * SECOND)).toBe('hace 59 min')
    expect(formatAgo(3600 * SECOND)).toBe('hace 1 h')
    expect(formatAgo(86_399 * SECOND)).toBe('hace 23 h')
    expect(formatAgo(86_400 * SECOND)).toBe('hace 1 día')
    expect(formatAgo(19 * 86_400 * SECOND)).toBe('hace 19 días')
  })

  it('formatAgo nunca enseña tiempo negativo (reloj del navegador por detrás del servidor)', () => {
    expect(formatAgo(-5000)).toBe('hace 0 s')
  })

  it('formatHandshake: "Nunca" sin handshake, relativo si lo hay, guion si la fecha es inválida', () => {
    expect(formatHandshake(null, NOW)).toBe('Nunca')
    expect(formatHandshake('2026-11-01T11:59:52Z', NOW)).toBe('hace 8 s')
    expect(formatHandshake('no-es-una-fecha', NOW)).toBe('—')
  })

  it('formatHandshakeAbsolute da día, mes y hora local con segundos', () => {
    expect(formatHandshakeAbsolute(new Date(2026, 10, 3, 14, 5, 9).toISOString())).toBe('3 nov · 14:05:09')
    expect(formatHandshakeAbsolute(null)).toBe('Sin handshake registrado')
  })
})

describe('claves y dueños', () => {
  it('formatShortKey abrevia las claves largas y deja intactas las cortas', () => {
    expect(formatShortKey('p7Qm2KxV9bR4tLzH1cN8wE3yF6jD0sGaU5oI2kTqWfA=')).toBe('p7Qm2KxV9b…TqWfA=')
    expect(formatShortKey('corta')).toBe('corta')
  })

  it('getOwnerInitials', () => {
    expect(getOwnerInitials('Ana')).toBe('AN')
    expect(getOwnerInitials(' marcos ')).toBe('MA')
    expect(getOwnerInitials(null)).toBe('–')
    expect(getOwnerInitials('  ')).toBe('–')
  })

  it('withCurrentOwner añade al dueño actual si no está en la lista, para que el selector no quede vacío', () => {
    const owners = [{ id: 1, name: 'Marcos' }]
    expect(withCurrentOwner(owners, { ownerId: 1, ownerName: 'Marcos' })).toEqual(owners)
    expect(withCurrentOwner(owners, { ownerId: null, ownerName: null })).toEqual(owners)
    expect(withCurrentOwner(owners, { ownerId: 7, ownerName: 'Leo' })).toEqual([...owners, { id: 7, name: 'Leo' }])
    expect(withCurrentOwner(owners, { ownerId: 8, ownerName: null })).toEqual([...owners, { id: 8, name: 'Usuario 8' }])
  })
})

describe('lectura desactualizada', () => {
  it('es desactualizada solo al pasar de 5 minutos', () => {
    const at = (ms: number): string => new Date(NOW - ms).toISOString()
    expect(isSnapshotStale(at(SNAPSHOT_STALE_MS), NOW)).toBe(false)
    expect(isSnapshotStale(at(SNAPSHOT_STALE_MS + 1), NOW)).toBe(true)
    expect(isSnapshotStale(at(40 * SECOND), NOW)).toBe(false)
  })

  it('la edad nunca es negativa ni NaN', () => {
    expect(getSnapshotAgeMs('2026-11-01T12:00:30Z', NOW)).toBe(0)
    expect(getSnapshotAgeMs('no-es-una-fecha', NOW)).toBe(0)
  })
})

describe('revocación pendiente', () => {
  it('sin revocación no hay edad ni retraso', () => {
    expect(getRevocationAgeMs(device(), NOW)).toBeNull()
    expect(isRevocationOverdue(device(), NOW)).toBe(false)
  })

  it('se considera retrasada solo al pasar de 3 minutos', () => {
    const requested = (ms: number): VpnDevice => device({ revocationRequestedAt: new Date(NOW - ms).toISOString() })
    expect(isRevocationOverdue(requested(25 * SECOND), NOW)).toBe(false)
    expect(isRevocationOverdue(requested(REVOCATION_OVERDUE_MS), NOW)).toBe(false)
    expect(isRevocationOverdue(requested(REVOCATION_OVERDUE_MS + 1), NOW)).toBe(true)
    expect(getRevocationAgeMs(requested(25 * SECOND), NOW)).toBe(25 * SECOND)
  })

  it('findCompletedRevocations: solo los que estaban en "Revocando…" y ya no aparecen', () => {
    const pending = device({ publicKey: 'a', name: 'Tablet', revocationRequestedAt: '2026-11-01T11:58:00Z' })
    const normal = device({ publicKey: 'b', name: 'Portátil' })
    // Desaparece uno normal (p. ej. revocado por SSH): no es una revocación pedida desde HomeDB
    expect(findCompletedRevocations([pending, normal], [pending])).toEqual([])
    expect(findCompletedRevocations([pending, normal], [normal])).toEqual(['Tablet'])
    // Sigue en la lista (la revocación no ha terminado): no se avisa
    expect(findCompletedRevocations([pending], [pending])).toEqual([])
    expect(findCompletedRevocations([], [normal])).toEqual([])
  })

  it('isRevokeConfirmed exige el nombre exacto, sin importar los espacios de los bordes', () => {
    expect(isRevokeConfirmed('Tablet salón', 'Tablet salón')).toBe(true)
    expect(isRevokeConfirmed('  Tablet salón ', 'Tablet salón')).toBe(true)
    expect(isRevokeConfirmed('tablet salón', 'Tablet salón')).toBe(false)
    expect(isRevokeConfirmed('Tablet', 'Tablet salón')).toBe(false)
    expect(isRevokeConfirmed('', 'Tablet salón')).toBe(false)
  })
})

describe('resumen', () => {
  const devices = [
    device({ publicKey: 'a', isActive: true, bytesReceived: 1024 * 1024, bytesSent: 1024 * 1024 }),
    device({ publicKey: 'b', bytesReceived: 2 * 1024 * 1024, bytesSent: 0 }),
  ]

  it('summarizeDevices suma activos y tráfico', () => {
    expect(summarizeDevices(devices)).toEqual({ total: 2, active: 1, receivedBytes: 3 * 1024 * 1024, sentBytes: 1024 * 1024 })
    expect(summarizeDevices([])).toEqual({ total: 0, active: 0, receivedBytes: 0, sentBytes: 0 })
  })

  it('describeSummary concuerda en singular y plural', () => {
    expect(describeSummary(summarizeDevices(devices))).toBe('2 dispositivos · 1 activo · 4 MB de tráfico')
    expect(describeSummary({ total: 1, active: 1, receivedBytes: 0, sentBytes: 0 })).toBe('1 dispositivo · 1 activo · 0 B de tráfico')
    expect(describeSummary({ total: 8, active: 3, receivedBytes: 0, sentBytes: 0 })).toContain('8 dispositivos · 3 activos')
  })
})

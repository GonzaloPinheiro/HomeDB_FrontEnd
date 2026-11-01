import type { VpnDevice } from './types'

// CLAUDE.md §6.22: búsqueda, filtros y orden de la lista de dispositivos (todo en cliente,
// sobre lo ya cargado: una VPN doméstica tiene decenas de dispositivos, no miles).

export type StatusFilter = 'all' | 'active' | 'inactive'
/** `all`, `none` (sin dueño) o el id del usuario como texto (los `<Select>` solo manejan texto). */
export type OwnerFilter = string
export type DeviceSort = 'name' | 'handshake' | 'traffic'

export type DeviceFilters = {
  query: string
  status: StatusFilter
  owner: OwnerFilter
}

export const DEFAULT_FILTERS: DeviceFilters = { query: '', status: 'all', owner: 'all' }

export function hasActiveFilters(filters: DeviceFilters): boolean {
  return filters.query.trim() !== '' || filters.status !== 'all' || filters.owner !== 'all'
}

/** Minúsculas y sin tildes: "movil" encuentra "Móvil de Ana". */
export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * Búsqueda y dueño, SIN el filtro de estado: son los dispositivos sobre los que se calculan los
 * recuentos de "Todos / Activos / Inactivos", para que cada pestaña diga cuántos habría al elegirla.
 */
export function filterByQueryAndOwner(
  devices: readonly VpnDevice[],
  filters: Pick<DeviceFilters, 'query' | 'owner'>,
): VpnDevice[] {
  const needle = normalizeSearch(filters.query.trim())
  return devices.filter((device) => {
    if (needle !== '' && !normalizeSearch(device.name).includes(needle) && !device.assignedIp.includes(needle)) {
      return false
    }
    if (filters.owner === 'all') return true
    if (filters.owner === 'none') return device.ownerId === null
    return String(device.ownerId) === filters.owner
  })
}

export function filterByStatus(devices: readonly VpnDevice[], status: StatusFilter): VpnDevice[] {
  if (status === 'all') return devices.slice()
  return devices.filter((device) => (status === 'active') === device.isActive)
}

export type StatusCounts = Record<StatusFilter, number>

export function countByStatus(devices: readonly VpnDevice[]): StatusCounts {
  const active = devices.filter((device) => device.isActive).length
  return { all: devices.length, active, inactive: devices.length - active }
}

/**
 * Nombre: alfabético. Handshake: el más reciente primero y los que nunca se han conectado al
 * final. Tráfico: el que más ha movido primero. No muta la entrada.
 */
export function sortDevices(devices: readonly VpnDevice[], sort: DeviceSort): VpnDevice[] {
  const copy = devices.slice()
  switch (sort) {
    case 'name':
      return copy.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    case 'handshake':
      return copy.sort((a, b) => {
        if (a.lastHandshakeAt === null || b.lastHandshakeAt === null) {
          return Number(a.lastHandshakeAt === null) - Number(b.lastHandshakeAt === null)
        }
        return new Date(b.lastHandshakeAt).getTime() - new Date(a.lastHandshakeAt).getTime()
      })
    case 'traffic':
      return copy.sort((a, b) => b.bytesReceived + b.bytesSent - (a.bytesReceived + a.bytesSent))
  }
}

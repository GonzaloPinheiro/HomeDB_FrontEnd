import type { VpnDevice, VpnOwner } from '../types'

// CLAUDE.md §6.22: dispositivos de ejemplo para que la maqueta se vea como la real. Editables a
// mano para probar estados. Se borran junto con el resto de `mock/`.

const KB = 1024
const MB = KB * 1024
const GB = MB * 1024
const DAY_S = 86_400

export const MOCK_OWNERS: VpnOwner[] = [
  { id: 1, name: 'Marcos' },
  { id: 2, name: 'Ana' },
  { id: 3, name: 'Leo' },
]

function ownerName(ownerId: number | null): string | null {
  return MOCK_OWNERS.find((owner) => owner.id === ownerId)?.name ?? null
}

// Clave pública, nombre, IP, segundos desde el último handshake (null = nunca), endpoint,
// bytes recibidos y enviados, dueño y notas.
type SeedRow = readonly [string, string, string, number | null, string | null, number, number, number | null, string | null]

const SEED: readonly SeedRow[] = [
  ['p7Qm2KxV9bR4tLzH1cN8wE3yF6jD0sGaU5oI2kTqWfA=', 'Móvil de Ana', '10.6.0.2', 8, '88.12.43.201:51820', 1.84 * GB, 312 * MB, 2, 'iPhone. Conectado siempre que sale de casa.'],
  ['Zr3eY8uB1nM6qW0xK4vC7hJ2sL9dF5gT3aP8oE1iR0c=', 'Portátil trabajo', '10.6.0.3', 55, '213.0.87.14:40122', 6.42 * GB, 1.21 * GB, 1, 'Para entrar en Archivos desde la oficina.'],
  ['bH5kN2pS8vD1fG4jL7zX0cV3mQ6wE9rT2yU5iO8aW4s=', 'Tablet salón', '10.6.0.4', 3 * DAY_S + 4210, '95.124.18.6:39310', 724 * MB, 58.3 * MB, null, 'iPad compartido. Se usa sobre todo en viajes.'],
  ['Kc8tR1wQ4eZ7yA0uS3dF6gH9jL2kX5vB8nM1pO4iU7g=', 'Móvil de Marcos', '10.6.0.5', 0, '2.139.201.77:61002', 3.12 * GB, 640 * MB, 1, null],
  ['Ux2mP5oL8kJ1hG4fD7sA0zX3cV6bN9qW2eR5tY8uI1k=', 'Portátil de Leo', '10.6.0.6', 8130, '147.96.3.110:52114', 412 * MB, 96.4 * MB, 3, 'Para la residencia de estudiantes.'],
  ['Ew6yT9rE2wQ5aS8dF1gH4jK7lZ0xC3vB6nM9mP2oL5i=', 'TV casa del pueblo', '10.6.0.7', 128, '79.116.5.30:41641', 9.87 * GB, 184 * MB, 1, 'Fire TV. Ve vídeos de Archivos en remoto.'],
  ['Mn4bV7cX0zL3kJ6hG9fD2sA5qW8eR1tY4uI7oP0aS3d=', 'Móvil antiguo', '10.6.0.8', null, null, 0, 0, 3, 'Perfil generado; aún no se ha importado en el móvil.'],
  ['Gt1fR4eD7cV0bN3mJ6hY9uT2gB5nH8jM1kL4oI7uY0t=', 'Router de viaje', '10.6.0.9', 19 * DAY_S + 7200, '185.43.12.9:51820', 186 * KB, 41 * KB, null, null],
]

/** La "Tablet salón": el dispositivo al que se le simula una revocación en curso. */
const REVOKING_KEY = SEED[2][0]

/** WireGuard da un dispositivo por activo si su último handshake tiene menos de ~3 minutos. */
const ACTIVE_HANDSHAKE_SECONDS = 180

export function buildMockDevices(snapshotMs: number, revocationRequestedAtMs: number | null): VpnDevice[] {
  return SEED.map(([publicKey, name, assignedIp, handshakeAgeSeconds, endpoint, received, sent, ownerId, notes]) => ({
    publicKey,
    name,
    assignedIp,
    isActive: handshakeAgeSeconds !== null && handshakeAgeSeconds < ACTIVE_HANDSHAKE_SECONDS,
    lastHandshakeAt: handshakeAgeSeconds === null ? null : new Date(snapshotMs - handshakeAgeSeconds * 1000).toISOString(),
    endpoint,
    bytesReceived: Math.round(received),
    bytesSent: Math.round(sent),
    ownerId,
    ownerName: ownerName(ownerId),
    notes,
    revocationRequestedAt:
      publicKey === REVOKING_KEY && revocationRequestedAtMs !== null ? new Date(revocationRequestedAtMs).toISOString() : null,
  }))
}

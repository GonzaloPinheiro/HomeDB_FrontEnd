import { ApiError } from '@/shared/api/client'
import { ApiErrorCodes } from '@/shared/api/errors'

import { VPN_ERROR_CODES, type VpnOwner, type VpnSnapshot } from '../types'
import { MOCK_OWNERS, buildMockDevices } from './data'
import { getMockScenario, type MockScenario } from './scenario'

// CLAUDE.md §6.22: sustituto del backend de la VPN, que todavía no existe. Devuelve los datos de
// `data.ts` tras una latencia simulada, para que los skeletons y estados de carga se ejerciten
// como con red real, y según `?mock=` (scenario.ts) falla igual que fallaría la API. Las
// funciones imitan la forma de las futuras llamadas HTTP (async, sin parámetros de UI) para que
// `api.ts` cambie solo por dentro al conectar el backend.
// Solo hay lecturas: las escrituras (guardar dueño y notas, revocar) no llaman a nada.

const LATENCY_MS = 350

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Estados en los que la lectura falla, con el código y estado HTTP que usaría el back
const FAILING_SCENARIOS: Partial<Record<MockScenario, () => ApiError>> = {
  error: () => new ApiError(VPN_ERROR_CODES.Unavailable, 'No se pudo leer el estado de WireGuard', { httpStatus: 500 }),
  forbidden: () => new ApiError(ApiErrorCodes.Unauthorized, 'No tienes acceso a este recurso', { httpStatus: 403 }),
  ratelimited: () => new ApiError(ApiErrorCodes.RateLimitExceeded, 'Demasiadas peticiones', { httpStatus: 429 }),
}

// La lectura "desactualizada" se queda congelada: una nueva petición devuelve la MISMA lectura, como
// pasaría con el temporizador del host parado, para poder ver el aviso de "no hay datos nuevos".
let frozenStaleSnapshotMs: number | null = null

async function respond<T>(produce: (scenario: MockScenario) => T): Promise<T> {
  const scenario = getMockScenario()
  // Nunca resuelve: deja el skeleton a la vista para revisarlo
  if (scenario === 'loading') return new Promise<T>(() => undefined)
  await wait(LATENCY_MS)
  const failure = FAILING_SCENARIOS[scenario]
  if (failure) throw failure()
  return produce(scenario)
}

export function getSnapshot(): Promise<VpnSnapshot> {
  return respond((scenario) => {
    const now = Date.now()
    if (scenario === 'stale') {
      frozenStaleSnapshotMs ??= now - 7 * 60_000 - 12_000
      return { snapshotAt: new Date(frozenStaleSnapshotMs).toISOString(), devices: buildMockDevices(frozenStaleSnapshotMs, null) }
    }
    const snapshotMs = now - 40_000
    if (scenario === 'empty') return { snapshotAt: new Date(snapshotMs).toISOString(), devices: [] }
    // Revocación pedida hace 25 s (en curso) o hace 3 min 20 s (lleva demasiado)
    const revocationRequestedAt = scenario === 'revoking' ? now - 25_000 : scenario === 'revokepending' ? now - 200_000 : null
    return { snapshotAt: new Date(snapshotMs).toISOString(), devices: buildMockDevices(snapshotMs, revocationRequestedAt) }
  })
}

export function listOwners(): Promise<VpnOwner[]> {
  return respond(() => MOCK_OWNERS)
}

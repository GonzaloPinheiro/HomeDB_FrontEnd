import { ApiError } from '@/shared/api/client'
import { ApiErrorCodes } from '@/shared/api/errors'

import type {
  AdBlockerHistoryPoint,
  AdBlockerStats,
  AdBlockerStatus,
  AlertSettings,
  BlockedService,
  DomainCheckResult,
  FilterListStatus,
} from '../types'
import { ADBLOCKER_ERROR_CODES } from '../types'
import {
  MOCK_ALERT_SETTINGS,
  MOCK_ALLOWLIST,
  MOCK_DOMAIN_RULES,
  MOCK_PANEL_URL,
  MOCK_SERVICES,
  MOCK_TOP_DOMAINS,
  buildMockFilterLists,
  buildMockHistory,
  buildMockStats,
} from './data'
import { getMockScenario, type MockScenario } from './scenario'

// CLAUDE.md §6.21: sustituto del backend de AdGuard, que todavía no existe. Devuelve los
// datos de `data.ts` tras una latencia simulada, para que los skeletons y estados de carga
// se ejerciten como con red real, y según `?mock=` (scenario.ts) falla igual que fallaría
// la API. Las funciones imitan la forma de las futuras llamadas HTTP (async, sin parámetros
// de UI) para que `api.ts` cambie solo por dentro al conectar el backend.
// Solo hay lecturas: las acciones de escritura no llaman a nada (los botones avisan de que
// aún no están disponibles).

const LATENCY_MS = 350

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Estados en los que TODA petición falla, con el código y estado HTTP que usaría el back
const FAILING_SCENARIOS: Partial<Record<MockScenario, () => ApiError>> = {
  unconfigured: () =>
    new ApiError(ADBLOCKER_ERROR_CODES.NotConfigured, 'AdGuard no está configurado', { httpStatus: 424 }),
  badcreds: () =>
    new ApiError(ADBLOCKER_ERROR_CODES.InvalidCredentials, 'AdGuard rechaza las credenciales', { httpStatus: 424 }),
  unreachable: () => new ApiError(ADBLOCKER_ERROR_CODES.Unreachable, 'AdGuard no responde', { httpStatus: 502 }),
  forbidden: () => new ApiError(ApiErrorCodes.Unauthorized, 'No tienes acceso a este recurso', { httpStatus: 403 }),
}

async function respond<T>(produce: (scenario: MockScenario) => T): Promise<T> {
  const scenario = getMockScenario()
  // Nunca resuelve: deja el skeleton a la vista para revisarlo
  if (scenario === 'loading') return new Promise<T>(() => undefined)
  await wait(LATENCY_MS)
  const failure = FAILING_SCENARIOS[scenario]
  if (failure) throw failure()
  return produce(scenario)
}

export function getStatus(): Promise<AdBlockerStatus> {
  return respond((scenario) => {
    const base = {
      safeBrowsingEnabled: true,
      parentalControlEnabled: false,
      safeSearchEnabled: true,
      panelUrl: MOCK_PANEL_URL,
    }
    if (scenario === 'paused') {
      // 30 min menos 47 s: la cuenta atrás se ve ya empezada
      return {
        ...base,
        protectionEnabled: false,
        pausedUntil: new Date(Date.now() + 30 * 60_000 - 47_000).toISOString(),
      }
    }
    if (scenario === 'disabled') return { ...base, protectionEnabled: false, pausedUntil: null }
    return { ...base, protectionEnabled: true, pausedUntil: null }
  })
}

// El 429 del limitador global de HomeDB (§7.4), no el de AdGuard
function rateLimitedError(): ApiError {
  return new ApiError(ApiErrorCodes.RateLimitExceeded, 'Demasiadas peticiones', { httpStatus: 429 })
}

// En `ratelimited` fallan SOLO las estadísticas y el histórico (las peticiones que más se
// repetirán): el resto de la pantalla sigue con sus datos y se enseña el aviso.
export function getStats(): Promise<AdBlockerStats> {
  return respond((scenario) => {
    if (scenario === 'ratelimited') throw rateLimitedError()
    return buildMockStats()
  })
}

export function getHistory(from: string, to: string): Promise<AdBlockerHistoryPoint[]> {
  return respond((scenario) => {
    if (scenario === 'ratelimited') throw rateLimitedError()
    return scenario === 'emptyhist' ? [] : buildMockHistory(from, to)
  })
}

export function listAllowlist(): Promise<string[]> {
  return respond(() => MOCK_ALLOWLIST)
}

export function listBlockedServices(): Promise<BlockedService[]> {
  return respond(() => MOCK_SERVICES)
}

export function listFilterLists(): Promise<FilterListStatus[]> {
  return respond(() => buildMockFilterLists(Date.now()))
}

export function getAlertSettings(): Promise<AlertSettings> {
  return respond(() => MOCK_ALERT_SETTINGS)
}

export function checkDomain(domain: string): Promise<DomainCheckResult> {
  return respond(() => {
    const isAllowlisted = MOCK_ALLOWLIST.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`))
    if (isAllowlisted) return { domain, isBlocked: false, matchedFilterName: null, isAllowlisted }

    const top = MOCK_TOP_DOMAINS.find((entry) => entry.domain === domain)
    if (top) return { domain, isBlocked: true, matchedFilterName: top.filter, isAllowlisted }

    const rule = MOCK_DOMAIN_RULES.find(([pattern]) => pattern.test(domain))
    if (rule) return { domain, isBlocked: true, matchedFilterName: rule[1], isAllowlisted }

    return { domain, isBlocked: false, matchedFilterName: null, isAllowlisted }
  })
}

// CLAUDE.md §6.22: la maqueta puede enseñar cada estado de la pantalla sin tocar código.
// Solo en desarrollo, con `?mock=<estado>` en la URL (p. ej. /admin/vpn?mock=revoking); en una
// build de producción siempre es `normal`. Recarga la página al cambiarlo: se lee al hacer cada
// petición simulada, no es estado de React.
export const MOCK_SCENARIOS = [
  'normal',
  'loading',
  'empty',
  'revoking',
  'revokepending',
  'stale',
  'error',
  'forbidden',
  'ratelimited',
] as const

export type MockScenario = (typeof MOCK_SCENARIOS)[number]

function isMockScenario(value: string | null): value is MockScenario {
  return value !== null && (MOCK_SCENARIOS as readonly string[]).includes(value)
}

export function getMockScenario(): MockScenario {
  if (!import.meta.env.DEV) return 'normal'
  const value = new URLSearchParams(window.location.search).get('mock')
  return isMockScenario(value) ? value : 'normal'
}

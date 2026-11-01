import type {
  AdBlockerHistoryPoint,
  AdBlockerStats,
  AlertSettings,
  BlockedService,
  ClientCount,
  DomainCount,
  FilterListStatus,
} from '../types'

// CLAUDE.md §6.21: datos de ejemplo de AdGuard, para que la maqueta se vea como la real.
// Editables a mano para probar estados. Se borran junto con el resto de `mock/`.

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

export const MOCK_PANEL_URL = 'http://192.168.1.2:3000'

export const MOCK_TOTAL_QUERIES = 41_382
export const MOCK_BLOCKED_QUERIES = 10_427

/** Dominio bloqueado de ejemplo y la lista que lo bloquea (alimenta también el comprobador). */
export const MOCK_TOP_DOMAINS: ReadonlyArray<DomainCount & { filter: string }> = [
  { domain: 'googleads.g.doubleclick.net', count: 1842, filter: 'AdGuard DNS filter' },
  { domain: 'app-measurement.com', count: 1316, filter: 'EasyPrivacy' },
  { domain: 'graph.facebook.com', count: 974, filter: 'HaGeZi Multi PRO' },
  { domain: 'analytics.tiktok.com', count: 811, filter: 'EasyPrivacy' },
  { domain: 'mobile.events.data.microsoft.com', count: 702, filter: 'HaGeZi Multi PRO' },
  { domain: 'pagead2.googlesyndication.com', count: 655, filter: 'AdGuard DNS filter' },
  { domain: 'log-config.samsungacr.com', count: 588, filter: 'OISD Big' },
  { domain: 'metrics.icloud.com', count: 441, filter: 'EasyPrivacy' },
  { domain: 'static.criteo.net', count: 317, filter: 'AdAway Default Blocklist' },
  { domain: 'ads.yahoo.com', count: 236, filter: 'OISD Big' },
]

export const MOCK_TOP_CLIENTS: ClientCount[] = [
  { clientIdentifier: 'Smart TV salón', count: 9214 },
  { clientIdentifier: 'iPhone de Ana', count: 7860 },
  { clientIdentifier: '192.168.1.23', count: 6102 },
  { clientIdentifier: 'Portátil de Marcos', count: 5430 },
  { clientIdentifier: 'iPad de Leo', count: 3211 },
  { clientIdentifier: '192.168.1.57', count: 2880 },
  { clientIdentifier: 'Echo de la cocina', count: 2115 },
  { clientIdentifier: 'Pixel de Leo', count: 1640 },
  { clientIdentifier: 'raspberrypi', count: 1402 },
  { clientIdentifier: '192.168.1.88', count: 790 },
]

export function buildMockStats(): AdBlockerStats {
  return {
    totalQueries: MOCK_TOTAL_QUERIES,
    blockedQueries: MOCK_BLOCKED_QUERIES,
    blockedPercentage: (MOCK_BLOCKED_QUERIES / MOCK_TOTAL_QUERIES) * 100,
    topBlockedDomains: MOCK_TOP_DOMAINS.map(({ domain, count }) => ({ domain, count })),
    topClients: MOCK_TOP_CLIENTS,
  }
}

/** Reglas para que el comprobador devuelva algo verosímil con dominios que no están en el top. */
export const MOCK_DOMAIN_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/doubleclick|googlesyndication|adservice|googleads/, 'AdGuard DNS filter'],
  [/analytics|metrics|telemetry|tracking|tracker|pixel|collector|app-measurement/, 'EasyPrivacy'],
  [/(^|\.)ads?\.|adserver|criteo|taboola|outbrain|adnxs/, 'OISD Big'],
  [/tiktok|samsungacr|graph\.facebook/, 'HaGeZi Multi PRO'],
  [/phish|malware/, 'Phishing Army'],
]

export const MOCK_ALLOWLIST: string[] = [
  's.youtube.com',
  't.co',
  'www.googleadservices.com',
  'dl.delivery.mp.microsoft.com',
  'click.redditmail.com',
]

// Nombre, reglas, activa y antigüedad en horas. La fecha real se calcula al pedirla.
const MOCK_LISTS: ReadonlyArray<readonly [string, number, boolean, number]> = [
  ['AdGuard DNS filter', 58_214, true, 3],
  ['AdAway Default Blocklist', 6_540, true, 3],
  ['OISD Big', 212_880, true, 5],
  ["Steven Black's Unified hosts", 133_402, true, 26],
  ['HaGeZi Multi PRO', 182_110, true, 50],
  ['EasyPrivacy', 51_327, true, 12 * 24],
  ['Phishing Army', 154_770, true, 1],
  ["Dan Pollock's hosts", 11_910, false, 38 * 24],
]

export function buildMockFilterLists(nowMs: number): FilterListStatus[] {
  return MOCK_LISTS.map(([name, ruleCount, enabled, ageHours]) => ({
    name,
    ruleCount,
    enabled,
    lastUpdated: new Date(nowMs - ageHours * HOUR_MS).toISOString(),
  }))
}

export const MOCK_ALERT_SETTINGS: AlertSettings = { enabled: true, thresholdPercent: 15 }

// El catálogo real de AdGuard tiene unos 150 servicios; con estos hay de sobra para
// ejercitar el scroll, el buscador y el filtro "Solo bloqueados".
const SERVICE_NAMES = [
  'Amazon', 'Amazon Music', 'Apple Music', 'Apple TV+', 'Atresplayer', 'Battle.net', 'BeReal', 'Bet365',
  'Bluesky', 'Booking.com', 'Call of Duty', 'Candy Crush', 'Canva', 'ChatGPT', 'Claude', 'Clash of Clans',
  'Codere', 'Crunchyroll', 'DAZN', 'Deezer', 'Discord', 'Disney+', 'Dropbox', 'Duolingo', 'eBay',
  'Epic Games', 'Facebook', 'Fortnite', 'GitHub', 'Glovo', 'Gmail', 'Google Drive', 'Instagram',
  'League of Legends', 'LinkedIn', 'Max', 'Messenger', 'Microsoft Teams', 'Minecraft', 'Netflix',
  'Notion', 'OnlyFans', 'Paramount+', 'Pinterest', 'PlayStation Network', 'Prime Video', 'Reddit',
  'Roblox', 'Shein', 'Signal', 'Skype', 'Slack', 'Snapchat', 'Spotify', 'Steam', 'Telegram', 'Temu',
  'Threads', 'Tinder', 'TikTok', 'Twitch', 'Uber', 'Valorant', 'Vinted', 'Wallapop', 'WhatsApp',
  'X (Twitter)', 'Xbox Live', 'YouTube', 'Zoom',
]

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

const INITIALLY_BLOCKED = new Set(['tiktok', 'roblox', 'temu', 'onlyfans', 'bet365', 'codere'])

export const MOCK_SERVICES: BlockedService[] = SERVICE_NAMES.map((name) => {
  const id = slugify(name)
  return { id, name, blocked: INITIALLY_BLOCKED.has(id) }
})

// --- Histórico ----------------------------------------------------------------------

// Pseudoaleatorio determinista: el gráfico no cambia entre recargas ni entre tests.
function seeded(index: number): number {
  const x = Math.sin(index * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

// Actividad diaria: mínimo de madrugada (~4 h) y máximo por la tarde.
function activity(hour: number): number {
  return 0.22 + 0.78 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (hour - 4)) / 24))
}

/**
 * Serie sintética para la ventana pedida. El paso crece con el rango (30 min, 2 h,
 * 12 h, 1 día) y son como mucho 120 puntos: es lo que la maqueta necesita para
 * dibujar, no una promesa de cómo agregará el backend (ver `AdBlockerHistoryPoint`).
 */
export function buildMockHistory(fromIso: string, toIso: string): AdBlockerHistoryPoint[] {
  const from = Date.parse(fromIso)
  const to = Date.parse(toIso)
  const span = to - from
  const step =
    span <= 36 * HOUR_MS ? HOUR_MS / 2 : span <= 8 * DAY_MS ? 2 * HOUR_MS : span <= 31 * DAY_MS ? 12 * HOUR_MS : DAY_MS
  const count = Math.max(1, Math.min(120, Math.floor(span / step) + 1))
  const end = Math.floor(to / step) * step

  const points: AdBlockerHistoryPoint[] = []
  for (let index = 0; index < count; index++) {
    const timestamp = end - (count - 1 - index) * step
    const date = new Date(timestamp)
    const hour = date.getHours() + date.getMinutes() / 60
    const seed = Math.floor(timestamp / step) + step / 1e5

    let factor = step <= 2 * HOUR_MS ? activity(hour) / 0.61 : 1
    if (step >= 12 * HOUR_MS && (date.getDay() === 0 || date.getDay() === 6)) factor *= 1.12
    const totalQueries = Math.round(1720 * (step / HOUR_MS) * factor * (0.85 + 0.3 * seeded(seed)))
    const ratio = 0.21 + 0.06 * seeded(seed + 7) + (step <= 2 * HOUR_MS && hour < 7 ? 0.02 : 0)

    points.push({
      timestamp: new Date(timestamp).toISOString(),
      totalQueries,
      blockedQueries: Math.round(totalQueries * ratio),
    })
  }
  return points
}

// CLAUDE.md §6.21: modelo de dominio de AdGuard Home. El backend NO tiene todavía
// ningún endpoint de esto (octubre 2026): este contrato sale del diseño planificado
// en el Notion ("Mejoras futuras" -> "Integración de red — AdGuard Home"), no de
// código verificado. Los campos marcados SUGERENCIA no están en ese diseño: la
// pantalla los necesita y se añadieron aquí para que la maqueta sea realista.
// PENDIENTE (CLAUDE.md §6.21): cuando exista el backend, releer su código real y
// ajustar estos tipos; añadir entonces `schemas.ts` (Zod) con la forma de wire real
// y derivar los tipos de ahí, como hacen el resto de features.

export type AdBlockerStatus = {
  protectionEnabled: boolean
  safeBrowsingEnabled: boolean
  parentalControlEnabled: boolean
  safeSearchEnabled: boolean
  /** ISO — solo mientras la protección está pausada con duración. */
  pausedUntil: string | null
  /**
   * SUGERENCIA (no está en el Notion): URL del panel nativo de AdGuard, para el botón
   * "Abrir panel". Ningún endpoint la expone hoy y sin ella el front no puede enlazarlo.
   * Solo es alcanzable desde la red local (o la VPN).
   */
  panelUrl: string | null
}

export type DomainCount = { domain: string; count: number }
export type ClientCount = { clientIdentifier: string; count: number }

/** Resumen de las últimas 24 h de AdGuard (`AdBlockerStatsDto`). */
export type AdBlockerStats = {
  totalQueries: number
  blockedQueries: number
  blockedPercentage: number
  topBlockedDomains: DomainCount[]
  topClients: ClientCount[]
}

/**
 * Un punto del histórico (`AdBlockerHistoryPointDto`).
 * PENDIENTE (CLAUDE.md §5.4/§6.21): la maqueta lo trata como consultas DENTRO de cada
 * intervalo. Pero `AdBlockMetric` guarda lo que devuelve `GetStatsAsync`, que es la
 * ventana móvil de 24 h de AdGuard: o el back calcula diferencias entre muestras, o el
 * gráfico solo puede mostrar el % móvil de 24 h. Decidirlo al implementar el endpoint.
 */
export type AdBlockerHistoryPoint = {
  /** ISO. */
  timestamp: string
  totalQueries: number
  blockedQueries: number
}

export type DomainCheckResult = {
  domain: string
  isBlocked: boolean
  matchedFilterName: string | null
  /**
   * SUGERENCIA (no está en `DomainCheckResultDto`): distingue "permitido por tu lista"
   * de "ninguna lista lo bloquea", que son mensajes distintos en la pantalla.
   */
  isAllowlisted: boolean
}

export type FilterListStatus = {
  name: string
  /** ISO. */
  lastUpdated: string
  ruleCount: number
  enabled: boolean
}

export type BlockedService = {
  id: string
  name: string
  blocked: boolean
}

export type AlertSettings = {
  enabled: boolean
  thresholdPercent: number
}

/**
 * Códigos de error PROVISIONALES de la integración: no existen en el backend ni en
 * `shared/api/errors.ts` (que solo recoge los reales). Se definen aquí, dentro de la
 * feature, a propósito. Importante: el backend NO debe responder HTTP 401 por
 * credenciales de AdGuard rechazadas — el interceptor de axios (§5.2) lo tomaría por
 * sesión caducada y expulsaría al usuario a /login. Usar 502/424 u otro 4xx/5xx.
 * PENDIENTE (CLAUDE.md §5.4): sustituir por los valores reales de `ApiErrorCodes`.
 */
export const ADBLOCKER_ERROR_CODES = {
  NotConfigured: 1028,
  InvalidCredentials: 1029,
  Unreachable: 1030,
} as const

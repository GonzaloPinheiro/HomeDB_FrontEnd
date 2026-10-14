import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/shared/api/client'
import type { ApiObjResponse } from '@/shared/types/api'

import { metricsHistorySchema, systemMetricsSchema } from './types'

export const METRIC_RANGES = ['1h', '24h', '7d', '30d'] as const
export type MetricRange = (typeof METRIC_RANGES)[number]

export const RANGE_LABELS: Record<MetricRange, string> = {
  '1h': '1h',
  '24h': '24h',
  '7d': '7d',
  '30d': '30d',
}

const RANGE_MS: Record<MetricRange, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

/**
 * CLAUDE.md §6.13: chips de rango, nunca un selector de fechas libre — el
 * backend no limita `/system-metrics/history` por su cuenta (§5.4, confirmado
 * en la Fase 6 que sigue así, con un TODO literal en el controller pendiente
 * de arreglar). Traduce cada chip a un `from`/`to` real anclado a `now`
 * (timestamps completos con milisegundos y `Z`, no fecha pelada — no dispara
 * el bug de DateTimeOffset/Npgsql documentado en §5.4 para Logs/Auditoría,
 * que solo ocurre con fechas sin hora).
 */
export function rangeToQuery(range: MetricRange, now: Date = new Date()): { from: string; to: string } {
  return {
    from: new Date(now.getTime() - RANGE_MS[range]).toISOString(),
    to: now.toISOString(),
  }
}

// CLAUDE.md §5.4/§7.9 (Fase 6): SystemMetrics:SampleIntervalMinutes de
// PRODUCCIÓN (appsettings.json base) es 1 minuto, confirmado por lectura
// directa del backend — el front apunta a este valor porque es el entorno
// real de despliegue (Raspberry Pi), no al valor de desarrollo local (5 min,
// solo en appsettings.Development.json de este repo).
export const SAMPLE_INTERVAL_MS = 60_000

export const systemMonitorKeys = {
  lastMetric: ['system-monitor', 'last-metric'] as const,
  history: (range: MetricRange) => ['system-monitor', 'history', range] as const,
}

/**
 * GET /system-metrics/last-metric. CLAUDE.md §5.4: si no hay ninguna muestra
 * todavía en BD, esto no llega como `data: null` — el backend responde 404
 * con `MetricNotFound` (1010). El componente que consume esto debe tratar
 * `query.isError` como "sin datos todavía" (estado vacío, §6.9), no como un
 * fallo genérico de red.
 */
export function useLastMetric() {
  return useQuery({
    queryKey: systemMonitorKeys.lastMetric,
    queryFn: async () => {
      const response = await api.get<ApiObjResponse<unknown>>('/system-metrics/last-metric')
      return systemMetricsSchema.parse(unwrap(response.data))
    },
    refetchInterval: SAMPLE_INTERVAL_MS,
  })
}

export function useMetricsHistory(range: MetricRange) {
  return useQuery({
    queryKey: systemMonitorKeys.history(range),
    queryFn: async () => {
      const { from, to } = rangeToQuery(range)
      const response = await api.get<ApiObjResponse<unknown>>('/system-metrics/history', {
        params: { from, to },
      })
      return metricsHistorySchema.parse(unwrap(response.data))
    },
    refetchInterval: SAMPLE_INTERVAL_MS,
  })
}

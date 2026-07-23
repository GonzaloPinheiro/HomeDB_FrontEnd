export type MetricKey = 'cpu' | 'memory' | 'disk' | 'temperature'
export type ThresholdStatus = 'normal' | 'critical'

/**
 * CLAUDE.md §6.13: "color por umbral... ej. >85% de uso, temperatura alta" —
 * el backend no expone ningún umbral propio para estas métricas, así que son
 * valores razonables definidos por este front (documentados en el informe de
 * Fase 6, no inventados sin criterio): 85% para CPU/memoria/disco (uso
 * sostenido por encima de esto ya es motivo de mirar), 75°C para temperatura
 * (con throttling térmico típico de un Raspberry Pi entre 80-85°C, 75°C deja
 * margen de aviso antes de llegar ahí).
 */
export const METRIC_THRESHOLDS: Record<MetricKey, number> = {
  cpu: 85,
  memory: 85,
  disk: 85,
  temperature: 75,
}

export const METRIC_UNITS: Record<MetricKey, string> = {
  cpu: '%',
  memory: '%',
  disk: '%',
  temperature: '°C',
}

/**
 * Lógica pura de umbral -> estado, extraída para poder testearla (§9) sin
 * montar componentes. `value === null` (sensor caído, §5.4) se trata como
 * "normal" — no hay dato con el que decidir que algo va mal.
 */
export function getThresholdStatus(key: MetricKey, value: number | null): ThresholdStatus {
  if (value === null) return 'normal'
  return value > METRIC_THRESHOLDS[key] ? 'critical' : 'normal'
}

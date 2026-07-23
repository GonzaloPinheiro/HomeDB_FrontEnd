export type NormalizedFanMode = 'off' | 'manual' | 'automatic' | 'unknown'

/**
 * CLAUDE.md §5.4: `FanControlMode` es un `string?` libre, sin enum compartido
 * entre el lector real de Linux (`"off"|"manual"|"automatic"|"unknown"`) y el
 * lector falso de desarrollo (`"Auto"|"Manual"`, activo en este entorno
 * Windows — verificado en vivo). No basta con comparar en minúsculas: el
 * lector falso escribe `"Auto"`, que en minúsculas da `"auto"`, una palabra
 * DISTINTA de `"automatic"` (no solo un casing distinto). Decisión propia de
 * este front (Fase 6, no pedida explícitamente): alias deliberado de
 * `"auto"` -> `"automatic"`, porque ambos representan el mismo concepto y sin
 * él la mitad de las muestras en desarrollo se verían como modo "desconocido"
 * sin motivo real.
 */
export function normalizeFanControlMode(mode: string | null): NormalizedFanMode {
  if (!mode) return 'unknown'
  const lower = mode.toLowerCase()
  if (lower === 'off') return 'off'
  if (lower === 'manual') return 'manual'
  if (lower === 'automatic' || lower === 'auto') return 'automatic'
  return 'unknown'
}

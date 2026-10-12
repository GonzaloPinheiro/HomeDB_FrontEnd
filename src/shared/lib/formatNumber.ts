// Separador de miles también en números de 4 cifras ("1.284"): en es-ES, Intl
// solo agrupa a partir de 5 cifras por defecto (minimumGroupingDigits).
const INTEGER = new Intl.NumberFormat('es-ES', { useGrouping: 'always', maximumFractionDigits: 0 })

/** Entero -> texto con separador de miles en español: 1284 -> "1.284". */
export function formatInteger(value: number): string {
  return Number.isFinite(value) ? INTEGER.format(value) : '—'
}

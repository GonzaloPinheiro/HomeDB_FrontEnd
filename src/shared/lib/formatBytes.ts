const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/**
 * Bytes -> texto legible ("2.4 GB", "240 KB"). Único punto de formateo de
 * tamaños en toda la app (CLAUDE.md §5.5). Un decimal para valores < 10,
 * ninguno a partir de ahí (mismo criterio que los ejemplos de §6.12).
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`

  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value)
  return `${rounded} ${UNITS[unitIndex]}`
}

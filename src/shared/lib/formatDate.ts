// CLAUDE.md §5.5: las fechas del backend llegan como string ISO con sufijo Z —
// un único helper de formateo para toda la app, no reimplementar por componente.

const DAY_MONTH = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/**
 * ISO -> fecha corta en español para tablas: "12 jul" (año en curso) o
 * "12 jul 2025" (otros años). `now` es inyectable solo para los tests.
 */
export function formatShortDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const formatter = date.getFullYear() === now.getFullYear() ? DAY_MONTH : DAY_MONTH_YEAR
  // Algunas versiones de ICU abrevian el mes con punto ("jul.") — se normaliza sin él
  return formatter.format(date).replace(/\./g, '')
}

const FULL_DATE_TIME = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/**
 * ISO -> fecha y hora completas en español: "12 jul 2026, 14:35:02". Usado en
 * el despliegue inline de fila de Logs/Auditoría (§6.8), donde se muestra el
 * timestamp completo sin resumir.
 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return FULL_DATE_TIME.format(date).replace(/\./g, '')
}

const DAY_MONTH_TIME = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const DAY_MONTH_YEAR_TIME = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * ISO -> fecha y hora compactas para paneles estrechos: "12 jul, 03:00" (año en
 * curso) o "12 jul 2025, 03:00" (otros años). Sin segundos, a diferencia de
 * `formatDateTime`. `now` es inyectable solo para los tests.
 */
export function formatShortDateTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const formatter = date.getFullYear() === now.getFullYear() ? DAY_MONTH_TIME : DAY_MONTH_YEAR_TIME
  return formatter.format(date).replace(/\./g, '')
}

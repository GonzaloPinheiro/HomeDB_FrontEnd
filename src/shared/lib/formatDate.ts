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

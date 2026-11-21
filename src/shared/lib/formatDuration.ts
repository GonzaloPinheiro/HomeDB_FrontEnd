/**
 * Milisegundos -> duración legible en español ("45 s", "2 min 14 s", "1 h 05 min").
 * Único punto de formateo de duraciones (mismo criterio que `formatBytes`,
 * CLAUDE.md §5.5). Valores negativos o no finitos -> "—".
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'

  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds} s`

  const totalMinutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (totalMinutes < 60) return `${totalMinutes} min ${seconds} s`

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours} h ${String(minutes).padStart(2, '0')} min`
}

/**
 * Milisegundos -> duración corta que conserva la precisión útil para medir tiempos de
 * respuesta: "850 ms", "1,5 s", "59,9 s"; a partir de un minuto delega en `formatDuration`.
 * `formatDuration` redondea al segundo (para duraciones largas de subidas y backups) y haría
 * indistinguibles 1,2 s y 1,4 s. Segundos con un decimal y coma (es-ES), sin ",0" sobrante.
 */
export function formatMillis(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'

  const rounded = Math.round(ms)
  if (rounded < 1000) return `${rounded} ms`

  // Décimas de segundo: si redondean a un minuto ("60,0 s"), se muestra como minutos
  const tenths = Math.round(ms / 100)
  if (tenths >= 600) return formatDuration(ms)

  const seconds = tenths % 10 === 0 ? String(tenths / 10) : (tenths / 10).toFixed(1).replace('.', ',')
  return `${seconds} s`
}

/**
 * Milisegundos transcurridos -> "hace 8 s" / "hace 5 min" / "hace 3 h" / "hace 1 día" / "hace 19 días".
 * Nunca enseña tiempo negativo: el reloj del navegador puede ir por detrás del del servidor
 * (VPN §6.22, almacenamiento §6.13). Antes vivía en `features/vpn`; subió a `shared/` al usarlo
 * también el Monitor.
 */
export function formatAgo(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `hace ${seconds} s`
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`
  if (seconds < 86_400) return `hace ${Math.floor(seconds / 3600)} h`
  const days = Math.floor(seconds / 86_400)
  return days === 1 ? 'hace 1 día' : `hace ${days} días`
}

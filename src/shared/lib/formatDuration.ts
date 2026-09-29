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

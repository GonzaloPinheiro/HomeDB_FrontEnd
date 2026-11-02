/**
 * CLAUDE.md §6.1/§6.7: mapeo de `Level` real (Information/Warning/Error/Critical,
 * ver types.ts) a la insignia semántica. Lógica pura extraída para poder
 * testearla (§9) sin montar el componente. Cualquier valor no reconocido cae
 * en el tratamiento "Info" (neutro) — tolerante a que el backend añada un
 * nivel nuevo sin que la UI se rompa.
 *
 * Error y Critical comparten el rojo apagado pero NO el aspecto: Critical (excepción no
 * controlada) va con los colores invertidos —fondo rojo, texto claro—, para que se distinga a
 * golpe de vista de un Error en una tabla densa sin añadir un tono nuevo a la paleta (§6.1).
 */
export type LevelBadgeStyle = {
  label: string
  className: string
}

export function levelBadgeStyle(level: string): LevelBadgeStyle {
  if (level === 'Warning') {
    return { label: level, className: 'bg-warning-bg text-warning-text' }
  }
  if (level === 'Error') {
    return { label: level, className: 'bg-critical-bg text-critical-text' }
  }
  if (level === 'Critical') {
    return { label: level, className: 'bg-critical-text text-critical-bg' }
  }
  // §6.1: Info neutro — surface/border-light de fondo, text-secondary de texto
  return { label: level, className: 'bg-surface text-text-secondary border-border-light' }
}

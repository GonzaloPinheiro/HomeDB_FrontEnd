/**
 * CLAUDE.md §6.1/§6.7: mapeo de `Level` real (Information/Warning/Critical,
 * ver types.ts) a la insignia semántica. Lógica pura extraída para poder
 * testearla (§9) sin montar el componente. Cualquier valor no reconocido cae
 * en el tratamiento "Info" (neutro) — tolerante a que el backend añada un
 * nivel nuevo sin que la UI se rompa.
 */
export type LevelBadgeStyle = {
  label: string
  className: string
}

export function levelBadgeStyle(level: string): LevelBadgeStyle {
  if (level === 'Warning') {
    return { label: level, className: 'bg-warning-bg text-warning-text' }
  }
  if (level === 'Critical') {
    return { label: level, className: 'bg-critical-bg text-critical-text' }
  }
  // §6.1: Info neutro — surface/border-light de fondo, text-secondary de texto
  return { label: level, className: 'bg-surface text-text-secondary border-border-light' }
}

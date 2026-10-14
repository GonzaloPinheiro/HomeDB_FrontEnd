// CLAUDE.md §6.13: el backend no agrega ni limita /system-metrics/history, así
// que el rango de 30d llega con una muestra por minuto (~43.000 puntos). Pasarlos
// todos a recharts atasca el render (sobre todo en móvil) sin aportar nada: un
// gráfico de ~600px no distingue más de unos centenares de puntos.
export const MAX_CHART_POINTS = 500

/**
 * Reduce `data` a como mucho `maxPoints` puntos repartiendo la serie en tramos
 * iguales y quedándose con el punto de mayor valor de `valueOf` de cada uno —
 * así los picos (el motivo de mirar un gráfico de CPU/temperatura) no se
 * suavizan. Un tramo sin ningún valor conserva su primer punto, para que los
 * huecos de sensor caído (`null`, §5.4) siguen viéndose como hueco y no como 0.
 * Mantiene el orden cronológico y no muta la entrada.
 */
export function downsampleSeries<T>(
  data: readonly T[],
  valueOf: (item: T) => number | null,
  maxPoints: number = MAX_CHART_POINTS,
): T[] {
  if (data.length <= maxPoints) return data.slice()

  const result: T[] = []
  const bucketSize = data.length / maxPoints
  for (let bucket = 0; bucket < maxPoints; bucket++) {
    const start = Math.floor(bucket * bucketSize)
    const end = Math.floor((bucket + 1) * bucketSize)
    let best = data[start]
    let bestValue = valueOf(best)
    for (let index = start + 1; index < end; index++) {
      const value = valueOf(data[index])
      if (value !== null && (bestValue === null || value > bestValue)) {
        best = data[index]
        bestValue = value
      }
    }
    result.push(best)
  }
  return result
}

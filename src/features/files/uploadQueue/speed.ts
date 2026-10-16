// CLAUDE.md §7.4: velocidad de subida y tiempo restante. Lógica pura (reloj
// inyectado) para poder testearla sin temporizadores reales (§9).

// Ventana de la media. Más corta reacciona antes pero salta con cada chunk
// que arranca o termina; 10s suaviza sin tardar demasiado en notar un cambio.
export const SPEED_WINDOW_MS = 10_000

// Con menos tiempo de muestra que esto la velocidad es ruido (los primeros
// eventos de progreso de un chunk llegan en ráfaga): se devuelve `null`.
const MIN_SPAN_MS = 1_000

type Sample = { at: number; transmitted: number }

/**
 * Velocidad media de envío sobre una ventana deslizante.
 *
 * Cuenta bytes TRANSMITIDOS (acumulado monótono), no bytes confirmados: cuando
 * un chunk falla y se reintenta, el total "subido" retrocede, pero esos bytes
 * sí viajaron por la red. Con el total directo la velocidad se iría a 0 en
 * cada reintento aunque el enlace siga a pleno rendimiento.
 */
export class SpeedTracker {
  private samples: Sample[] = []
  private lastTotal = 0
  private transmitted = 0

  /** Anota el total de bytes enviados del archivo en este instante (puede bajar si se reintenta un chunk). */
  record(at: number, totalBytes: number): void {
    this.transmitted += Math.max(0, totalBytes - this.lastTotal)
    this.lastTotal = totalBytes
    this.samples.push({ at, transmitted: this.transmitted })
    this.prune(at)
  }

  /**
   * Bytes/s sobre los últimos `SPEED_WINDOW_MS`, o `null` si aún no hay
   * muestra suficiente. Se mide hasta `now`, no hasta la última muestra: si la
   * subida se atasca (pausa por rate limit, red caída) la velocidad cae sola
   * en vez de quedarse congelada en el último valor bueno.
   */
  bytesPerSecond(now: number): number | null {
    this.prune(now)
    const first = this.samples[0]
    const last = this.samples[this.samples.length - 1]
    if (!first || !last || now - first.at < MIN_SPAN_MS) return null
    return (last.transmitted - first.transmitted) / ((now - first.at) / 1000)
  }

  private prune(now: number): void {
    const cutoff = now - SPEED_WINDOW_MS
    let drop = 0
    while (drop < this.samples.length && this.samples[drop].at < cutoff) drop += 1
    if (drop > 0) this.samples.splice(0, drop)
  }
}

/** Milisegundos que faltan al ritmo actual, o `null` si no se puede estimar (sin velocidad o parada). */
export function estimateRemainingMs(remainingBytes: number, bytesPerSecond: number | null): number | null {
  if (bytesPerSecond === null || bytesPerSecond <= 0 || remainingBytes < 0) return null
  return (remainingBytes / bytesPerSecond) * 1000
}

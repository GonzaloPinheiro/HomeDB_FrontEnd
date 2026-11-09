// CLAUDE.md §7.4: agrupa las invalidaciones de caché que provoca la cola de subidas.
// Lógica sin React ni TanStack Query — la invalidación real se inyecta — para poder
// testearla directamente (§9).
//
// Por qué existe: cada archivo que termina invalida el listado de su carpeta y el
// uso de almacenamiento, y `invalidateQueries` cancela y relanza el refetch que
// hubiera en vuelo (la petición sale igual). Con un lote grande de archivos
// pequeños eso son 2 peticiones EXTRA por archivo, tanto como el propio envío, y
// consumen el mismo cupo del rate limiter global (§7.4) que las subidas.

/** Separación mínima entre dos tandas de invalidaciones mientras la cola trabaja. */
export const INVALIDATION_INTERVAL_MS = 2_000

export type InvalidationBatch = {
  /** Carpetas (`null` = raíz) cuyo listado hay que refrescar. Sin repetidos. */
  folderIds: Array<number | null>
  /** Si hay que refrescar el uso de almacenamiento (§7.8). */
  storageUsage: boolean
}

/**
 * Throttle con flanco inicial y final:
 * - La PRIMERA marca tras un rato en calma se vacía al instante, así que subir un
 *   solo archivo refresca el listado igual de rápido que antes.
 * - Las marcas siguientes, mientras dura la ventana, se acumulan y salen juntas al
 *   cerrarse, de modo que nunca hay más de una tanda cada `intervalMs`.
 * - `flushNow` vacía lo pendiente sin esperar (la cola se ha quedado inactiva: lo
 *   último que subió debe verse ya, no dentro de 2 s).
 */
export class InvalidationBatcher {
  private readonly onFlush: (batch: InvalidationBatch) => void
  private readonly intervalMs: number

  private readonly pendingFolders = new Set<number | null>()
  private storagePending = false
  // Definido = hay una ventana abierta: lo que llegue ahora espera a que se cierre.
  private windowTimer: ReturnType<typeof setTimeout> | undefined

  // Sin parameter properties: el tsconfig activa `erasableSyntaxOnly`.
  constructor(onFlush: (batch: InvalidationBatch) => void, intervalMs: number = INVALIDATION_INTERVAL_MS) {
    this.onFlush = onFlush
    this.intervalMs = intervalMs
  }

  /**
   * Cambió el contenido de `folderId` (`null` = raíz): un archivo terminó de subirse
   * o se creó una carpeta dentro. `storageUsage` si además cambió el espacio ocupado
   * (un archivo nuevo). Es UNA sola llamada a propósito: con dos (carpeta y luego
   * almacenamiento) la primera abriría la ventana y la segunda esperaría a que se
   * cerrase, y un archivo suelto refrescaría el almacenamiento con retraso.
   */
  markChanged(folderId: number | null, options: { storageUsage?: boolean } = {}): void {
    this.pendingFolders.add(folderId)
    if (options.storageUsage) this.storagePending = true
    if (this.windowTimer !== undefined) return // ventana abierta: se vaciará al cerrarse
    this.flushNow()
    this.openWindow()
  }

  /** Vacía lo pendiente ya, sin cambiar la ventana en curso. No hace nada si no hay nada. */
  flushNow(): void {
    if (this.pendingFolders.size === 0 && !this.storagePending) return
    const batch: InvalidationBatch = {
      folderIds: [...this.pendingFolders],
      storageUsage: this.storagePending,
    }
    this.pendingFolders.clear()
    this.storagePending = false
    this.onFlush(batch)
  }

  /** Descarta lo pendiente y cancela la ventana (el proveedor se desmonta). El objeto sigue siendo utilizable. */
  dispose(): void {
    clearTimeout(this.windowTimer)
    this.windowTimer = undefined
    this.pendingFolders.clear()
    this.storagePending = false
  }

  private openWindow(): void {
    this.windowTimer = setTimeout(() => {
      this.windowTimer = undefined
      // Si durante la ventana llegó algo, sale ahora y se abre otra: así dos tandas
      // nunca quedan a menos de `intervalMs`. Si no, la ventana simplemente se cierra.
      if (this.pendingFolders.size > 0 || this.storagePending) {
        this.flushNow()
        this.openWindow()
      }
    }, this.intervalMs)
  }
}

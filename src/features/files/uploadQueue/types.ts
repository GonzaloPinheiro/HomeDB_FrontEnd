/**
 * `processing`: todos los chunks están en el servidor y `complete` ya fue aceptado
 * (202); el backend ensambla el archivo en background y el front espera el
 * resultado con GET /status (CLAUDE.md §7.4). Ya no ocupa hueco de subida ni se
 * puede cancelar (no hay endpoint para parar el worker), y cerrar la pestaña no
 * pierde nada: el servidor lo termina igualmente.
 */
export type UploadEntryStatus = 'queued' | 'uploading' | 'processing' | 'done' | 'error' | 'cancelled'

/** Estado visual de un chunk individual — CLAUDE.md §6.4: detalle expandible por archivo. */
export type ChunkStatus = 'pending' | 'uploading' | 'done' | 'error'

export type UploadQueueEntry = {
  id: string
  file: File
  folderId: number | null
  /** Nombre de la carpeta destino en el momento de encolar — se muestra por fila (§6.4), las entradas pueden apuntar a carpetas distintas si se han ido añadiendo desde varias visitas. */
  folderName: string
  status: UploadEntryStatus
  /** Progreso agregado 0-100 sobre el tamaño total del archivo, no del chunk en curso. */
  progress: number
  /** Bytes ya enviados (incluye lo que va en vuelo) — se refresca ~1 vez por segundo junto con la velocidad. */
  uploadedBytes: number
  /** Velocidad media reciente en bytes/s, o `null` si aún no se puede medir (speed.ts). */
  speedBytesPerSec: number | null
  /** 0 hasta que se conoce (tras responder POST /init). */
  totalChunks: number
  /** Vacío hasta que se conoce totalChunks; un valor por chunk, en orden. */
  chunks: ChunkStatus[]
  /** Id de la sesión de subida en el backend — se conserva tras un error para poder reanudar con GET /status (CLAUDE.md §7.4) en vez de repetir chunks ya confirmados. */
  sessionId?: string
  error?: string
  /**
   * Código de ApiErrorCodes del último fallo, o `null` si nunca llegó una
   * respuesta real del backend (corte de red, stall, timeout — ver toApiError).
   * CLAUDE.md §7.4: distingue un error de red (se reintenta solo al volver la
   * conexión) de un rechazo real del servidor (FileTooLarge, etc. — reintentar
   * solo no lo arregla, hace falta acción del usuario). `undefined` = tampoco hay
   * código de la API, pero el fallo no es de red (se agotó el plazo de espera del
   * procesado, ProcessingTimeoutError): tampoco se reintenta solo.
   */
  errorCode?: number | null
}

/** Carpeta activa para añadir archivos nuevos al abrir el panel. Ausente = panel de solo consulta (abierto desde la bandeja persistente en otra pantalla, CLAUDE.md §6.16). */
export type UploadTarget = {
  folderId: number | null
  folderName: string
}

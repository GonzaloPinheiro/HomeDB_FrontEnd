export type UploadEntryStatus = 'queued' | 'uploading' | 'done' | 'error' | 'cancelled'

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
   * solo no lo arregla, hace falta acción del usuario).
   */
  errorCode?: number | null
}

/** Carpeta activa para añadir archivos nuevos al abrir el panel. Ausente = panel de solo consulta (abierto desde la bandeja persistente en otra pantalla, CLAUDE.md §6.16). */
export type UploadTarget = {
  folderId: number | null
  folderName: string
}

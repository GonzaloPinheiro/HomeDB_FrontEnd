// CLAUDE.md §6.19: modelo de dominio de Torrents. El backend solo tiene hoy el
// flag de módulo (`torrentsEnabled`, §5.3): NO existe ningún endpoint de torrents
// todavía, así que este contrato es el que ASUME la maqueta, no uno verificado.
// PENDIENTE (CLAUDE.md §6.19): cuando exista el backend, releer su código real y
// ajustar estos tipos; añadir entonces `schemas.ts` (Zod) con la forma de wire real
// — incluidos los enums, que el backend serializa como número (usar `wireEnum`,
// §5.4) — y derivar de ahí los tipos, como hacen el resto de features.

export const TORRENT_CATEGORIES = ['movies', 'series', 'music', 'books', 'software'] as const
export type TorrentCategory = (typeof TORRENT_CATEGORIES)[number]

export const TORRENT_STATUSES = [
  'downloading',
  'queued',
  'paused',
  'seeding',
  'completed',
  'error',
  'contentDeleted',
] as const
export type TorrentStatus = (typeof TORRENT_STATUSES)[number]

/** Para qué sirve cada fichero del torrent al importarlo a la biblioteca. */
export const FILE_ROLES = ['mainVideo', 'subtitle', 'alternateAudio', 'extra', 'skip'] as const
export type FileRole = (typeof FILE_ROLES)[number]

/** Destino de la importación automática a la biblioteca de medios, si está pendiente. */
export type TorrentImportPlan = {
  /** Nombre con el que se guardará (p. ej. "Documental naturaleza (2024)"). */
  name: string
  /** Carpeta de destino en el servidor. */
  path: string
}

export type Torrent = {
  id: number
  name: string
  category: TorrentCategory
  status: TorrentStatus
  sizeBytes: number
  fileCount: number
  /** 0-100. `null` = sin dato (en cola, contenido borrado). */
  progressPercent: number | null
  downloadBytesPerSec: number | null
  etaSeconds: number | null
  /** Solo en cola: 1 = el siguiente en empezar. */
  queuePosition: number | null
  /** ISO — solo si el usuario lo ha pausado. */
  pausedAt: string | null
  /** Solo al sembrar / tras sembrar. */
  ratio: number | null
  ratioTarget: number | null
  /** Solo en error: la causa, tal cual para mostrarla. */
  errorMessage: string | null
  /** `null` = no se importa a la biblioteca (p. ej. Software, o ya importado). */
  pendingImport: TorrentImportPlan | null
  /** ISO. */
  addedAt: string
}

export type TorrentFile = {
  id: number
  /** Ruta relativa dentro del torrent. */
  name: string
  sizeBytes: number
  /**
   * Los roles solo aplican a vídeo (películas y series, §6.19). `null` = el torrent
   * no es de vídeo (música, libros, software): el fichero no tiene rol que elegir.
   */
  role: FileRole | null
  /** Código de idioma ("es", "en"…). Solo tiene sentido con el rol `subtitle`. */
  language: string | null
}

import { z } from 'zod'

// CLAUDE.md §7.4: subidas reanudables tras recargar la pestaña. Lógica sin React
// ni red (el almacenamiento se inyecta) para poder testearla directamente (§9).
//
// Qué se guarda: SOLO metadatos de las sesiones de subida que el servidor tiene
// abiertas (id, nombre, tamaño, fecha, destino…). Nunca el archivo: un `File` no
// sobrevive a una recarga, así que reanudar exige que el usuario vuelva a darlo
// (soltarlo o elegirlo) y entonces se reconoce y solo se envía lo que falta.
//
// Verificado en el backend (octubre 2026): una sesión `InProgress` NO caduca
// (`CleanupFinishedSessionsAsync` solo borra las `Completed`/`Cancelled`) y
// `GET /status` dice qué chunks tiene, así que reanudar es posible mientras exista.

/** Tope de antigüedad de un registro: pasada una semana se olvida (la sesión del servidor sigue ahí, pero ya no se ofrece). */
export const RESUMABLE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** Cota al nº de registros guardados, por si algo los acumulara sin control. Se descartan los más antiguos. */
export const MAX_RESUMABLE_RECORDS = 200

const resumableUploadSchema = z.object({
  sessionId: z.string(),
  fileName: z.string(),
  size: z.number(),
  lastModified: z.number(),
  // Los números de chunk que guarda el servidor solo significan algo para ESTE
  // tamaño de chunk. Si una versión futura del front lo cambia, reanudar una
  // sesión antigua ensamblaría un archivo corrupto sin ningún error: por eso se
  // guarda y solo se reanuda si coincide (`findResumable`).
  chunkSizeBytes: z.number(),
  totalChunks: z.number(),
  /** Carpeta REAL (ya resuelta) a la que está ligada la sesión en el servidor; `null` = raíz. */
  folderId: z.number().nullable(),
  /** Solo para mostrar ("Archivos/Fotos/2024"). */
  folderName: z.string(),
  /** `uploading`: faltan chunks. `processing`: ya enviado todo, el servidor ensambla (no hace falta el archivo). */
  phase: z.enum(['uploading', 'processing']),
  createdAt: z.number(),
})
export type ResumableUpload = z.infer<typeof resumableUploadSchema>

/** Subconjunto de `Storage` que usamos — permite pasar un doble en los tests. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

/** Por usuario: dos cuentas en el mismo navegador no deben verse las subidas. */
export function resumableStorageKey(userId: number): string {
  return `uploads.resumable.${userId}`
}

/** `localStorage` o `null` si no se puede usar (ventana privada, datos de sitio bloqueados): el acceso al propio `window.localStorage` puede lanzar. */
export function getBrowserStorage(): StorageLike | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Lee los registros guardados. Lo ilegible se ignora registro a registro: uno corrupto no se lleva por delante a los demás. */
export function parseResumableUploads(raw: string | null, now: number): ResumableUpload[] {
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []

  const records: ResumableUpload[] = []
  for (const item of data) {
    const parsed = resumableUploadSchema.safeParse(item)
    if (parsed.success && now - parsed.data.createdAt <= RESUMABLE_MAX_AGE_MS)
      records.push(parsed.data)
  }
  return records
}

/**
 * Registros de subidas reanudables de un usuario. Cada operación lee y escribe
 * contra el almacenamiento (en vez de mantener una copia en memoria) para que
 * dos pestañas abiertas se pisen lo mínimo. Cualquier fallo del almacenamiento se
 * traga: sin él las subidas funcionan igual, solo que no se pueden reanudar.
 */
export class ResumableStore {
  private readonly storage: StorageLike | null
  private readonly key: string
  private readonly now: () => number

  // Sin parameter properties: el tsconfig activa `erasableSyntaxOnly`.
  constructor(storage: StorageLike | null, key: string, now: () => number = Date.now) {
    this.storage = storage
    this.key = key
    this.now = now
  }

  list(): ResumableUpload[] {
    if (!this.storage) return []
    try {
      return parseResumableUploads(this.storage.getItem(this.key), this.now())
    } catch {
      return []
    }
  }

  upsert(record: ResumableUpload): void {
    const others = this.list().filter((existing) => existing.sessionId !== record.sessionId)
    this.write([...others, record].slice(-MAX_RESUMABLE_RECORDS))
  }

  setPhase(sessionId: string, phase: ResumableUpload['phase']): void {
    const records = this.list()
    const target = records.find((record) => record.sessionId === sessionId)
    if (!target || target.phase === phase) return
    this.write(records.map((record) => (record === target ? { ...record, phase } : record)))
  }

  remove(sessionId: string): void {
    const records = this.list()
    const remaining = records.filter((record) => record.sessionId !== sessionId)
    if (remaining.length !== records.length) this.write(remaining)
  }

  private write(records: ResumableUpload[]): void {
    try {
      this.storage?.setItem(this.key, JSON.stringify(records))
    } catch {
      // Cuota llena o almacenamiento bloqueado: la subida sigue, solo sin reanudación.
    }
  }
}

export type FileFingerprint = { fileName: string; size: number; lastModified: number }

/**
 * ¿Es este el mismo archivo que el del registro? Nombre, tamaño y fecha de
 * modificación: si cambió el contenido casi seguro cambió la fecha, y entonces es
 * otro archivo y se sube de cero.
 */
export function isSameFile(record: FileFingerprint, file: File): boolean {
  return (
    record.fileName === file.name &&
    record.size === file.size &&
    record.lastModified === file.lastModified
  )
}

export type ResumableQuery = FileFingerprint & {
  chunkSizeBytes: number
  totalChunks: number
  folderId: number | null
}

/**
 * Registro que se puede reanudar para este archivo y destino, o `undefined`.
 * Solo sesiones que aún esperan chunks (`uploading`) y cortadas con el MISMO
 * plan de chunks; `excluded` son las ya reclamadas por otra subida (dos copias
 * del mismo archivo no pueden compartir sesión). Si hay varias, la más reciente.
 */
export function findResumable(
  records: ResumableUpload[],
  query: ResumableQuery,
  excluded: ReadonlySet<string>,
): ResumableUpload | undefined {
  return records
    .filter(
      (record) =>
        record.phase === 'uploading' &&
        !excluded.has(record.sessionId) &&
        record.fileName === query.fileName &&
        record.size === query.size &&
        record.lastModified === query.lastModified &&
        record.chunkSizeBytes === query.chunkSizeBytes &&
        record.totalChunks === query.totalChunks &&
        record.folderId === query.folderId,
    )
    .sort((a, b) => b.createdAt - a.createdAt)[0]
}

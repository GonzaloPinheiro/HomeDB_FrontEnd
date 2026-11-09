import type { ApiError } from '@/shared/api/client'

import { CHUNK_SIZE_BYTES } from './pipeline'

// CLAUDE.md §7.4: subida directa de los archivos pequeños. Lógica sin React ni red
// (§9). Un archivo que cabe en un solo chunk se manda con UNA petición (`POST /files`)
// en vez de las 3 + consultas de la subida por sesión (`init` + chunk + `complete` +
// `status` hasta que termina): cada petición cuenta contra el rate limiter global y
// el ensamblado en background de un archivo de un solo chunk no aportaba nada.

/**
 * Hasta este tamaño (inclusive) un archivo se sube directo. Es una constante propia y
 * no `CHUNK_SIZE_BYTES` a secas para poder bajarla sin tocar el tamaño de los chunks
 * (p. ej. si se prefiere reanudar por chunks los de más de 8 MB: la subida directa no
 * se reanuda, si falla se repite entera), pero NUNCA puede superarlo: lo que no cabe
 * en un chunk tampoco se manda en una sola petición (límite de 35 MB del backend para
 * el chunk, y `directUpload.test.ts` lo fija). El `POST /files` en sí admite hasta
 * `Storage:MaxFileSizeBytes` (Kestrel y FormOptions), mucho más.
 */
export const DIRECT_UPLOAD_MAX_BYTES = CHUNK_SIZE_BYTES

export type UploadKind = 'direct' | 'chunked'

/**
 * Cómo se sube un archivo. Depende SOLO del tamaño: así una entrada no cambia de tipo
 * entre reintentos (una con sesión es siempre de más de un chunk) y el planificador
 * (scheduler.ts) puede clasificarla sin mirar nada más.
 */
export function uploadKindOf(sizeBytes: number): UploadKind {
  return sizeBytes <= DIRECT_UPLOAD_MAX_BYTES ? 'direct' : 'chunked'
}

/**
 * ¿Pudo la petición haber llegado al servidor y haber creado el archivo aunque aquí
 * haya fallado? Es la pregunta clave de la subida directa, que NO es idempotente: el
 * backend admite nombres repetidos, así que repetir una petición que sí llegó crea un
 * DUPLICADO (un chunk, en cambio, se puede reenviar sin riesgo).
 *
 * - **Incierto**: no hubo respuesta (red caída, stall, timeout, respuesta ilegible) o
 *   fue un 5xx — el servidor pudo guardar el archivo y fallar después (p. ej. al
 *   auditar), o un proxy cortar la respuesta (502/504 de Cloudflare).
 * - **Definitivo**: el servidor respondió que NO (4xx: `FileTooLarge`, `StorageLimitExceeded`,
 *   `InvalidFileExtension`, `FolderNotFound`...) o un `result: false` con código. Ahí no
 *   se creó nada y se puede repetir. El 429 tampoco se creó (lo rechaza el middleware
 *   antes del controller) y se trata aparte, con la pausa global (rateLimit.ts).
 */
export function isOutcomeUncertain(error: ApiError): boolean {
  if (error.httpStatus === null) return error.errorCode === null
  return error.httpStatus >= 500
}

/** Texto de la fila cuando no se sabe si el archivo llegó (se muestra tal cual, sin el del código de error). */
export const UNCERTAIN_OUTCOME_MESSAGE =
  'No se pudo confirmar la subida. Puede que el archivo ya esté en la carpeta: revísala antes de reintentar'

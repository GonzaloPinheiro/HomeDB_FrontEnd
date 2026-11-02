// Helpers puros sobre `URLSearchParams` para las tablas de Admin cuyo estado vive en la URL (CLAUDE.md
// §7.10). Sin React Router, para poder testearlos (§9); `useUrlFilters` los conecta a la URL.

const PAGE_KEY = 'page'

/** Un parámetro vacío (`?level=`) cuenta como ausente: nunca se envía al backend como filtro. */
export function readParam(params: URLSearchParams, key: string): string | null {
  const value = params.get(key)
  return value === null || value === '' ? null : value
}

/** Página de la URL: entero >= 1; cualquier otra cosa (texto, 0, negativos, decimales) se corrige. */
export function parsePageParam(params: URLSearchParams): number {
  const parsed = Number(params.get(PAGE_KEY))
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1
}

/** Copia de `current` con `patch` aplicado: `null` o `''` borran el parámetro. */
export function patchParams(
  current: URLSearchParams,
  patch: Readonly<Record<string, string | null>>,
): URLSearchParams {
  const next = new URLSearchParams(current)
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === '') next.delete(key)
    else next.set(key, value)
  }
  return next
}

/**
 * Copia de `current` en la que los parámetros `ownedKeys` pasan a ser EXACTAMENTE `next` (los que no se
 * nombran se borran) y la página vuelve a la primera. Los parámetros que no son de la tabla —p. ej.
 * `?settings=` del modal de ajustes, §6.20— se conservan.
 */
export function replaceParams(
  current: URLSearchParams,
  ownedKeys: ReadonlyArray<string>,
  next: Readonly<Record<string, string | null | undefined>>,
): URLSearchParams {
  const result = new URLSearchParams(current)
  result.delete(PAGE_KEY)
  for (const key of ownedKeys) {
    const value = next[key]
    if (value === undefined || value === null || value === '') result.delete(key)
    else result.set(key, value)
  }
  return result
}

/**
 * Valor de un filtro -> texto de URL: `null`, `undefined` y `''` significan "sin filtro" (`null`); un
 * número (p. ej. un `userId`) se serializa con `String`.
 */
export function serializeParam(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

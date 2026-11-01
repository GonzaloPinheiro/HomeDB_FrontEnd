// CLAUDE.md §6.21: validación de dominios del comprobador y de la lista de permitidos.
// El backend es la barrera real; esto solo evita enviar entradas evidentemente mal
// formadas y da el mensaje junto al campo (§6.11).

const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

export type DomainParseResult = { ok: true; domain: string } | { ok: false; message: string }

/**
 * Comprobador: tolerante con lo que se pega desde la barra del navegador. Quita el
 * esquema ("https://"), la ruta/consulta/ancla y el punto final: "https://Ads.Ejemplo.com/x?y" -> "ads.ejemplo.com".
 */
export function parseDomainToCheck(raw: string): DomainParseResult {
  const domain = raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .split(/[/?#]/)[0]
    .replace(/\.$/, '')
  if (domain === '') return { ok: false, message: 'Escribe un dominio para comprobarlo.' }
  if (!DOMAIN_PATTERN.test(domain)) {
    return { ok: false, message: 'Eso no parece un dominio válido (p. ej. ejemplo.com).' }
  }
  return { ok: true, domain }
}

/**
 * Lista de permitidos: estricta. Aquí se guarda lo que se escribe, así que no se
 * "adivina" nada: ni esquemas ni rutas. Solo se normaliza el espacio y las mayúsculas.
 */
export function parseDomainToAllow(raw: string, existing: readonly string[]): DomainParseResult {
  const domain = raw.trim().toLowerCase()
  if (domain === '') return { ok: false, message: 'Escribe un dominio.' }
  if (!DOMAIN_PATTERN.test(domain)) {
    return {
      ok: false,
      message: 'Formato no válido. Escribe solo el dominio, p. ej. ejemplo.com (sin http:// ni rutas).',
    }
  }
  if (existing.includes(domain)) return { ok: false, message: 'Ese dominio ya está en la lista.' }
  return { ok: true, domain }
}

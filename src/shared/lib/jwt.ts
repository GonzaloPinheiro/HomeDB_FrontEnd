// El backend construye el token con `new JwtSecurityToken(claims: ...)` sin mapa
// outbound (HomeDB.Infrastructure/Security/JwtService.cs), así que ClaimTypes.Role
// se serializa en el payload con su URI largo. userId y username van con nombre corto.
const ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'

export type AuthClaims = {
  userId: number
  username: string
  role: string
}

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/**
 * Decodifica el payload de un JWT y extrae los claims que usa la UI.
 * CLAUDE.md §5.2: solo para leer claims y pintar la UI — nunca para autenticar
 * peticiones (eso va por cookie httpOnly).
 */
export function decodeJwtClaims(token: string): AuthClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>
    const userId = Number(payload['userId'])
    const username = payload['username']
    // Tolerante al nombre corto "role" por si el backend cambia a un handler
    // que sí aplique el mapa outbound
    const role = payload[ROLE_CLAIM] ?? payload['role']
    if (!Number.isFinite(userId) || typeof username !== 'string' || typeof role !== 'string') {
      return null
    }
    return { userId, username, role }
  } catch {
    return null
  }
}

/**
 * CLAUDE.md §6.6 (decisión no evidente, §2): la búsqueda de Usuarios es un solo
 * campo combinado — si el texto contiene "@" se envía al backend como `Email`,
 * si no como `UserName`. Evita dos inputs separados para lo que el usuario
 * percibe como "buscar a alguien".
 */
export function splitSearchTerm(term: string): { userName?: string; email?: string } {
  const trimmed = term.trim()
  if (!trimmed) return {}
  return trimmed.includes('@') ? { email: trimmed } : { userName: trimmed }
}

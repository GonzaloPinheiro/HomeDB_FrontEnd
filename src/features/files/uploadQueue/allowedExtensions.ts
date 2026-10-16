// CLAUDE.md §5.4: copia de la lista blanca de extensiones del backend
// (HomeDB.Domain/Common/AllowedExtensions.cs, verificada en octubre 2026).
//
// Por qué está duplicada: el backend solo valida la extensión en `complete`,
// DESPUÉS de recibir todos los chunks — un archivo de decenas de GB con una
// extensión no admitida se subiría entero para ser rechazado al final (y la
// sesión se cancela y se borran los chunks). Rechazarlo al añadirlo a la cola
// ahorra esa espera. El backend sigue siendo la fuente de verdad: si esta lista
// se queda atrás, solo se bloquea de más en el front hasta actualizarla aquí.
const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  // Imágenes
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  // Vídeo
  '.mp4', '.mov',
  // Audio
  '.mp3', '.wav', '.flac',
  // Documentos
  '.pdf', '.docx', '.xlsx', '.txt', '.md', '.csv',
  // Comprimidos
  '.zip', '.7z', '.rar',
  // Código y datos
  '.json', '.xml', '.yaml', '.yml',
])

/** Extensión en minúsculas con el punto ("" si no tiene), con la misma regla que `Path.GetExtension` del backend. */
export function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot < 0 || dot === fileName.length - 1 ? '' : fileName.slice(dot).toLowerCase()
}

export function isAllowedExtension(fileName: string): boolean {
  return ALLOWED_EXTENSIONS.has(getExtension(fileName))
}

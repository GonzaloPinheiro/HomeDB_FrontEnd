import { env } from '@/shared/env'

// PENDIENTE (CLAUDE.md §5.4/§6.3b): el endpoint de miniaturas del backend aún NO
// existe. Con `false` la vista de miniaturas muestra el icono grande del tipo de
// archivo y no se hace ninguna petición (pedir miniaturas a una ruta inexistente
// solo gastaría cupo del rate limiter global, §7.4). Cuando exista: verificar su
// ruta, tipos soportados y qué responde si no hay miniatura posible (404/204),
// corregir `thumbnailUrl`/`supportsThumbnail` y poner esto a `true`.
export const THUMBNAILS_ENABLED: boolean = false

// PENDIENTE (CLAUDE.md §5.4): ruta supuesta, sin verificar contra el backend.
export function thumbnailUrl(fileId: number): string {
  return `${env.VITE_API_URL}/api/files/${fileId}/thumbnail`
}

// Solo imagen y vídeo tienen miniatura útil; para el resto basta el icono del
// tipo (pedirla sería una petición segura de fallar). Ajustar a lo que el
// backend genere realmente cuando exista el endpoint.
export function supportsThumbnail(contentType: string): boolean {
  return contentType.startsWith('image/') || contentType.startsWith('video/')
}

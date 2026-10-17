import { env } from '@/shared/env'

import type { ExplorerItem } from '../types'

// CLAUDE.md §6.3c: lo que el visor sabe sobre un archivo — qué tipos abre, de dónde
// los lee y la aritmética de saltar en un vídeo. Todo puro, sin React, para
// probarlo directamente (media.test.ts).

export type MediaKind = 'image' | 'video'

/**
 * Qué visor corresponde a un tipo MIME, o `null` si no se abre (descarga/menú).
 * Basta el prefijo: la lista blanca del backend (§5.4) solo deja pasar jpg, png,
 * gif, webp, mp4 y mov. Que el navegador pueda de verdad decodificarlo (p. ej.
 * un .mov en HEVC) solo se sabe al reproducirlo, y el visor lo cubre con su
 * estado de error (§6.3c) — `canPlayType` no es fiable para decidirlo antes.
 */
export function getMediaKind(contentType: string): MediaKind | null {
  if (contentType.startsWith('image/')) return 'image'
  if (contentType.startsWith('video/')) return 'video'
  return null
}

export type FileExplorerItem = Extract<ExplorerItem, { kind: 'file' }>

export function isViewableFile(item: ExplorerItem): item is FileExplorerItem {
  return item.kind === 'file' && getMediaKind(item.contentType) !== null
}

/**
 * URL del endpoint de streaming (`GET /files/{id}/stream`, §5.4): sirve el
 * archivo en línea (sin `Content-Disposition: attachment`) y con soporte de
 * `Range`, imprescindible para saltar en un vídeo. La usa directamente `<img>` /
 * `<video>`, así que la autenticación es la cookie (§5.2), no axios.
 */
export function streamUrl(fileId: number): string {
  return `${env.VITE_API_URL}/api/files/${fileId}/stream`
}

/** Segundos que saltan los botones y las teclas J/L del vídeo (§6.3c). */
export const SEEK_STEP_SECONDS = 10

/**
 * Nuevo `currentTime` tras saltar `delta` segundos, sin salirse de [0, duración].
 * Con duración desconocida (aún sin metadatos: NaN, o Infinity en directos) solo
 * se acota por abajo.
 */
export function clampSeek(current: number, delta: number, duration: number): number {
  const target = Math.max(0, current + delta)
  return Number.isFinite(duration) ? Math.min(target, duration) : target
}

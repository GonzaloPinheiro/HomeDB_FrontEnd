import { formatBytes } from '@/shared/lib/formatBytes'
import { formatTime } from '@/shared/lib/formatDate'

import type { Torrent, TorrentCategory, TorrentFile } from './types'

// CLAUDE.md §6.19: lógica de presentación pura de Torrents (textos derivados del
// modelo, agregados), sin React ni red — por eso se testea directamente
// (`presentation.test.ts`, §9).

// ---- Progreso ----------------------------------------------------------

/** Color de la barra: acento = descargando, positivo = a salvo, crítico = fallo. */
export type ProgressTone = 'accent' | 'neutral' | 'positive' | 'critical'

export type ProgressView = {
  /** 0-100, o `null` si no hay un valor que pintar (la barra queda vacía/indeterminada). */
  value: number | null
  /** Texto junto a la barra: "63 %", "1,4" (ratio) o "—". */
  label: string
  tone: ProgressTone
}

const RATIO = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function formatRatio(ratio: number): string {
  return RATIO.format(ratio)
}

function percent(torrent: Torrent): { value: number; label: string } | null {
  if (torrent.progressPercent === null) return null
  const value = Math.min(100, Math.max(0, torrent.progressPercent))
  return { value, label: `${Math.round(value)} %` }
}

/** Qué pinta la columna Progreso de un torrent según su estado. */
export function getProgressView(torrent: Torrent): ProgressView {
  const progress = percent(torrent)

  switch (torrent.status) {
    case 'downloading':
      return { value: progress?.value ?? null, label: progress?.label ?? '—', tone: 'accent' }
    case 'paused':
      return { value: progress?.value ?? null, label: progress?.label ?? '—', tone: 'neutral' }
    case 'error':
      return { value: progress?.value ?? null, label: progress?.label ?? '—', tone: 'critical' }
    case 'completed':
      return { value: 100, label: '100 %', tone: 'positive' }
    case 'seeding': {
      // Sembrando, lo que importa es el ratio: la barra mide cuánto falta para el objetivo
      if (torrent.ratio === null) return { value: null, label: '—', tone: 'positive' }
      const value =
        torrent.ratioTarget !== null && torrent.ratioTarget > 0
          ? Math.min(100, (torrent.ratio / torrent.ratioTarget) * 100)
          : 100
      return { value, label: formatRatio(torrent.ratio), tone: 'positive' }
    }
    case 'queued':
    case 'contentDeleted':
      return { value: null, label: '—', tone: 'neutral' }
  }
}

/** "6 min", "1 h 05 min". Por debajo del minuto, "< 1 min". */
export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  if (seconds < 60) return '< 1 min'
  const totalMinutes = Math.ceil(seconds / 60)
  if (totalMinutes < 60) return `${totalMinutes} min`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours} h ${String(minutes).padStart(2, '0')} min`
}

/** Línea de detalle bajo la barra de progreso. */
export function getProgressCaption(torrent: Torrent): string {
  switch (torrent.status) {
    case 'downloading': {
      const parts: string[] = []
      if (torrent.downloadBytesPerSec !== null) parts.push(`↓ ${formatBytes(torrent.downloadBytesPerSec)}/s`)
      if (torrent.etaSeconds !== null) parts.push(formatEta(torrent.etaSeconds))
      return parts.length > 0 ? parts.join(' · ') : 'Descargando'
    }
    case 'queued':
      return torrent.queuePosition !== null ? `Posición ${torrent.queuePosition} en cola` : 'En cola'
    case 'paused':
      return torrent.pausedAt !== null ? `Pausado por ti · ${formatTime(torrent.pausedAt)}` : 'Pausado por ti'
    case 'seeding':
      if (torrent.ratio === null) return 'Sembrando'
      return torrent.ratioTarget !== null
        ? `Ratio ${formatRatio(torrent.ratio)} de ${formatRatio(torrent.ratioTarget)}`
        : `Ratio ${formatRatio(torrent.ratio)}`
    case 'completed':
      return 'Siembra finalizada'
    case 'error':
      return torrent.errorMessage ?? 'Error desconocido'
    case 'contentDeleted':
      return 'Solo torrent guardado'
  }
}

// ---- Listado -----------------------------------------------------------

/** Cuántos torrents hay en cada categoría (todas presentes, aunque sea con 0). */
export function countByCategory(torrents: readonly Torrent[]): Record<TorrentCategory, number> {
  const counts: Record<TorrentCategory, number> = { movies: 0, series: 0, music: 0, books: 0, software: 0 }
  for (const torrent of torrents) counts[torrent.category] += 1
  return counts
}

// ---- Ficheros ----------------------------------------------------------

export type FileKind = 'video' | 'subtitle' | 'audio' | 'image' | 'archive' | 'document' | 'other'

const KIND_BY_EXTENSION: Record<string, FileKind> = {
  mkv: 'video',
  mp4: 'video',
  avi: 'video',
  mov: 'video',
  webm: 'video',
  m4v: 'video',
  srt: 'subtitle',
  ass: 'subtitle',
  ssa: 'subtitle',
  sub: 'subtitle',
  vtt: 'subtitle',
  mp3: 'audio',
  flac: 'audio',
  wav: 'audio',
  ogg: 'audio',
  m4a: 'audio',
  aac: 'audio',
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  webp: 'image',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  iso: 'archive',
  pdf: 'document',
  epub: 'document',
  txt: 'document',
  md: 'document',
  nfo: 'document',
}

/** Tipo de fichero por extensión, solo para elegir el icono. */
export function getFileKind(fileName: string): FileKind {
  const dot = fileName.lastIndexOf('.')
  if (dot === -1) return 'other'
  return KIND_BY_EXTENSION[fileName.slice(dot + 1).toLowerCase()] ?? 'other'
}

/** Lo que se descargará (todo menos «No descargar») frente al total del torrent. */
export function getDownloadSelection(files: readonly TorrentFile[]): { selectedBytes: number; totalBytes: number } {
  let selectedBytes = 0
  let totalBytes = 0
  for (const file of files) {
    totalBytes += file.sizeBytes
    // Sin rol (no es vídeo) = se descarga; solo «No descargar» excluye un fichero
    if (file.role !== 'skip') selectedBytes += file.sizeBytes
  }
  return { selectedBytes, totalBytes }
}

import type { FileRole, TorrentCategory, TorrentStatus } from './types'

// Textos de la feature en un único sitio (CLAUDE.md §6.19), para que ningún
// componente reescriba "Películas" o "Sembrando" por su cuenta.

export const CATEGORY_LABELS: Record<TorrentCategory, string> = {
  movies: 'Películas',
  series: 'Series',
  music: 'Música',
  books: 'Libros',
  software: 'Software',
}

export const STATUS_LABELS: Record<TorrentStatus, string> = {
  downloading: 'Descargando',
  queued: 'En cola',
  paused: 'Pausado',
  seeding: 'Sembrando',
  completed: 'Completado',
  error: 'Error',
  contentDeleted: 'Contenido borrado',
}

export const FILE_ROLE_LABELS: Record<FileRole, string> = {
  mainVideo: 'Vídeo principal',
  subtitle: 'Subtítulo',
  alternateAudio: 'Audio alternativo',
  extra: 'Extra',
  skip: 'No descargar',
}

// Matiz que acompaña al rol en el menú de selección (solo informativo).
export const FILE_ROLE_HINTS: Partial<Record<FileRole, string>> = {
  mainVideo: 'Solo uno',
}

export const LANGUAGE_LABELS: Record<string, string> = {
  es: 'Español',
  en: 'Inglés',
  fr: 'Francés',
  de: 'Alemán',
  it: 'Italiano',
  pt: 'Portugués',
}

/** Idioma legible; un código fuera de la tabla se muestra en mayúsculas en vez de ocultarse. */
export function languageLabel(code: string): string {
  return LANGUAGE_LABELS[code] ?? code.toUpperCase()
}

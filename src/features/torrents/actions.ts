import type { TorrentStatus } from './types'

// CLAUDE.md §6.19: qué acciones ofrece un torrent según su estado — el reparto
// del diseño aprobado ("acciones por estado"). Es lógica de presentación sin
// React: los iconos viven en `components/actionIcons.ts`.
// PENDIENTE (CLAUDE.md §6.19): ninguna acción hace nada todavía (maqueta). Cuando
// exista el backend, esta matriz seguirá siendo la fuente de qué botones se pintan
// (o se sustituirá por las acciones permitidas que devuelva la API, si las expone).

export type TorrentActionId =
  | 'pause'
  | 'resume'
  | 'startNow'
  | 'forceStart'
  | 'moveUp'
  | 'moveDown'
  | 'stopSeeding'
  | 'resumeSeeding'
  | 'openFolder'
  | 'retry'
  | 'redownload'
  | 'selectFiles'
  | 'priority'
  | 'limit'
  | 'uploadLimit'
  | 'verify'
  | 'changeDestination'
  | 'viewLog'
  | 'changeCategory'
  | 'copyMagnet'
  | 'viewSheet'
  | 'deleteContent'
  | 'remove'
  | 'removeFromLibrary'

export type TorrentAction = {
  id: TorrentActionId
  label: string
  /** Aclaración de las acciones destructivas, bajo la etiqueta en el menú. */
  description?: string
}

const ACTIONS: Record<TorrentActionId, TorrentAction> = {
  pause: { id: 'pause', label: 'Pausar' },
  resume: { id: 'resume', label: 'Reanudar' },
  startNow: { id: 'startNow', label: 'Iniciar ya' },
  forceStart: { id: 'forceStart', label: 'Forzar inicio' },
  moveUp: { id: 'moveUp', label: 'Subir en cola' },
  moveDown: { id: 'moveDown', label: 'Bajar en cola' },
  stopSeeding: { id: 'stopSeeding', label: 'Dejar de sembrar' },
  resumeSeeding: { id: 'resumeSeeding', label: 'Volver a sembrar' },
  openFolder: { id: 'openFolder', label: 'Abrir carpeta' },
  retry: { id: 'retry', label: 'Reintentar' },
  redownload: { id: 'redownload', label: 'Volver a bajar' },
  selectFiles: { id: 'selectFiles', label: 'Elegir ficheros' },
  priority: { id: 'priority', label: 'Prioridad' },
  limit: { id: 'limit', label: 'Límite de velocidad' },
  uploadLimit: { id: 'uploadLimit', label: 'Límite de subida' },
  verify: { id: 'verify', label: 'Verificar' },
  changeDestination: { id: 'changeDestination', label: 'Cambiar destino' },
  viewLog: { id: 'viewLog', label: 'Ver registro' },
  changeCategory: { id: 'changeCategory', label: 'Cambiar categoría' },
  copyMagnet: { id: 'copyMagnet', label: 'Copiar magnet' },
  viewSheet: { id: 'viewSheet', label: 'Ver ficha en medios' },
  deleteContent: {
    id: 'deleteContent',
    label: 'Borrar contenido',
    description: 'Conserva el torrent para volver a bajarlo',
  },
  remove: {
    id: 'remove',
    label: 'Eliminar',
    description: 'Opcional: borrar también los ficheros',
  },
  removeFromLibrary: { id: 'removeFromLibrary', label: 'Eliminar de la biblioteca' },
}

type StatusActionIds = {
  /** La acción visible en la propia fila. */
  primary: TorrentActionId
  /** Van en el menú «⋯», antes de las acciones comunes. */
  secondary: TorrentActionId[]
  /** Van al final del menú, tras un separador y en tono de aviso. */
  destructive: TorrentActionId[]
}

const BY_STATUS: Record<TorrentStatus, StatusActionIds> = {
  downloading: {
    primary: 'pause',
    secondary: ['forceStart', 'priority', 'selectFiles', 'limit'],
    destructive: ['deleteContent', 'remove'],
  },
  queued: {
    primary: 'startNow',
    secondary: ['moveUp', 'moveDown', 'pause'],
    destructive: ['remove'],
  },
  paused: {
    primary: 'resume',
    secondary: ['selectFiles', 'priority'],
    destructive: ['deleteContent', 'remove'],
  },
  seeding: {
    primary: 'stopSeeding',
    secondary: ['openFolder', 'uploadLimit'],
    destructive: ['deleteContent', 'remove'],
  },
  completed: {
    primary: 'openFolder',
    secondary: ['resumeSeeding', 'verify'],
    destructive: ['deleteContent', 'remove'],
  },
  error: {
    primary: 'retry',
    secondary: ['changeDestination', 'viewLog', 'verify'],
    destructive: ['deleteContent', 'remove'],
  },
  contentDeleted: {
    primary: 'redownload',
    secondary: [],
    destructive: ['removeFromLibrary'],
  },
}

// Disponibles en cualquier estado, tras las secundarias propias del estado.
const ALWAYS: TorrentActionId[] = ['changeCategory', 'copyMagnet', 'viewSheet']

export type TorrentActionSet = {
  primary: TorrentAction
  /** Secundarias del estado + las comunes, en el orden del menú. */
  menu: TorrentAction[]
  destructive: TorrentAction[]
}

export function getTorrentActions(status: TorrentStatus): TorrentActionSet {
  const entry = BY_STATUS[status]
  return {
    primary: ACTIONS[entry.primary],
    menu: [...entry.secondary, ...ALWAYS].map((id) => ACTIONS[id]),
    destructive: entry.destructive.map((id) => ACTIONS[id]),
  }
}

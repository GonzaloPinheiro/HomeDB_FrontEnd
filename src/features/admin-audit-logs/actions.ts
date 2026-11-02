import { AUDIT_ACTIONS, type AuditAction } from './types'

// Presentación de las acciones de auditoría (CLAUDE.md §6.24): etiqueta legible, categoría (para el icono)
// y gravedad (para el color). Puro, para poder testearlo (§9). `ACTION_META` es un `Record<AuditAction, …>`:
// si el backend añade una acción y se añade a `AUDIT_ACTIONS`, el typecheck obliga a describirla aquí.

export type ActionCategory = 'session' | 'account' | 'files' | 'folders'

/**
 * `sensitive`: toca credenciales o cuentas (merece un vistazo, ámbar); `destructive`: borra una cuenta
 * (rojo). El resto, `normal`, es el día a día. Color con propósito (§6.7).
 */
export type ActionSeverity = 'normal' | 'sensitive' | 'destructive'

type ActionMeta = { label: string; category: ActionCategory; severity: ActionSeverity }

const ACTION_META: Record<AuditAction, ActionMeta> = {
  LOGIN: { label: 'Inicio de sesión', category: 'session', severity: 'normal' },
  LOGOUT: { label: 'Cierre de sesión', category: 'session', severity: 'normal' },
  REGISTER: { label: 'Alta de usuario', category: 'account', severity: 'sensitive' },
  CHANGE_PASSWORD: { label: 'Cambio de contraseña', category: 'account', severity: 'sensitive' },
  UPDATE_PROFILE: { label: 'Perfil actualizado', category: 'account', severity: 'normal' },
  DELETE_USER: { label: 'Usuario eliminado', category: 'account', severity: 'destructive' },
  UPLOAD_FILE: { label: 'Archivo subido', category: 'files', severity: 'normal' },
  DOWNLOAD_FILE: { label: 'Archivo descargado', category: 'files', severity: 'normal' },
  DELETE_FILE: { label: 'Archivo eliminado', category: 'files', severity: 'normal' },
  CREATE_FOLDER: { label: 'Carpeta creada', category: 'folders', severity: 'normal' },
  CHANGE_FOLDER_NAME: { label: 'Carpeta renombrada', category: 'folders', severity: 'normal' },
  CHANGE_PARENT_FOLDER: { label: 'Carpeta movida', category: 'folders', severity: 'normal' },
  DELETE_FOLDER: { label: 'Carpeta eliminada', category: 'folders', severity: 'normal' },
}

// `Object.hasOwn` y no `in`: una acción llamada "toString" no debe colarse como conocida
function metaOf(action: string): ActionMeta | null {
  return Object.hasOwn(ACTION_META, action) ? ACTION_META[action as AuditAction] : null
}

/** Etiqueta en español; una acción que el front no conoce (el backend añadió una) se muestra tal cual. */
export function actionLabel(action: string): string {
  return metaOf(action)?.label ?? action
}

/** Una acción desconocida es `normal`: sin color hasta que se describa aquí. */
export function actionSeverity(action: string): ActionSeverity {
  return metaOf(action)?.severity ?? 'normal'
}

/** `null` para una acción desconocida (sin icono propio). */
export function actionCategory(action: string): ActionCategory | null {
  return metaOf(action)?.category ?? null
}

/** Acciones que las tarjetas de resumen cuentan aparte: todas las que no son `normal`. Una sola fuente. */
export const SENSITIVE_ACTIONS: ReadonlyArray<AuditAction> = AUDIT_ACTIONS.filter(
  (action) => ACTION_META[action].severity !== 'normal',
)

// Los tokens semánticos solo contrastan sobre su propio fondo (§6.21): cada gravedad es una pastilla.
const BADGE_CLASS: Record<ActionSeverity, string> = {
  normal: 'bg-surface text-text-secondary border-border-light',
  sensitive: 'bg-warning-bg text-warning-text',
  destructive: 'bg-critical-bg text-critical-text',
}

export function actionBadgeClass(severity: ActionSeverity): string {
  return BADGE_CLASS[severity]
}

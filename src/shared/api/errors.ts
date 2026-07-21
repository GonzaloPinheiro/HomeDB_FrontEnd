// CLAUDE.md §5.1: mapa completo de ApiErrorCodes -> mensaje. Único punto de
// verdad de toda la app — no reimplementar por feature. Verificado contra el
// enum real del backend (HomeDB.Domain/Common/ApiErrorCodes.cs, julio 2026):
// coincide 1:1 con la tabla de §5.1.
export const ApiErrorCodes = {
  FileNotFound: 1001,
  FolderNotFound: 1002,
  Unauthorized: 1003,
  FileTooLarge: 1004,
  FolderNotEmpty: 1005,
  InvalidCredentials: 1006,
  UserAlreadyExists: 1007,
  UserNotFound: 1008,
  RateLimitExceeded: 1009,
  MetricNotFound: 1010,
  EmailAlreadyExists: 1011,
  RoleNotFound: 1012,
  FolderCyclicReference: 1013,
  PermissionsNotFound: 1014,
  UserSettingsNotFound: 1015,
  StorageLimitExceeded: 1016,
  UserHasAssociatedData: 1017,
  InternalError: 9999,
} as const

const ERROR_MESSAGES: Record<number, string> = {
  [ApiErrorCodes.FileNotFound]: 'El archivo no existe o no tienes acceso a él',
  [ApiErrorCodes.FolderNotFound]: 'La carpeta no existe o no tienes acceso a ella',
  [ApiErrorCodes.Unauthorized]: 'No tienes acceso a este recurso',
  [ApiErrorCodes.FileTooLarge]: 'El archivo supera el tamaño máximo permitido',
  [ApiErrorCodes.FolderNotEmpty]: 'La carpeta tiene contenido y no se puede eliminar',
  [ApiErrorCodes.InvalidCredentials]: 'Usuario o contraseña incorrectos',
  [ApiErrorCodes.UserAlreadyExists]: 'Ese nombre de usuario ya está en uso',
  [ApiErrorCodes.UserNotFound]: 'El usuario no existe',
  [ApiErrorCodes.RateLimitExceeded]: 'Demasiadas peticiones — espera un momento y vuelve a intentarlo',
  [ApiErrorCodes.MetricNotFound]: 'No se encontró la métrica solicitada',
  [ApiErrorCodes.EmailAlreadyExists]: 'Ese email ya está en uso',
  [ApiErrorCodes.RoleNotFound]: 'El rol no existe',
  [ApiErrorCodes.FolderCyclicReference]: 'No se puede mover una carpeta dentro de sí misma',
  [ApiErrorCodes.PermissionsNotFound]: 'No se encontraron los permisos del usuario',
  [ApiErrorCodes.UserSettingsNotFound]: 'No se encontraron los ajustes del usuario',
  [ApiErrorCodes.StorageLimitExceeded]: 'Has superado tu límite de almacenamiento',
  [ApiErrorCodes.UserHasAssociatedData]: 'El usuario tiene archivos o carpetas y no se puede eliminar',
  [ApiErrorCodes.InternalError]: 'Error inesperado del servidor',
}

const GENERIC_MESSAGE = 'Algo ha ido mal — vuelve a intentarlo'

/**
 * Devuelve el mensaje en español para un código de error de la API.
 * CLAUDE.md §5.1: si el código es conocido se usa siempre su mensaje específico,
 * nunca un genérico; `fallback` (el errorMessage crudo del backend, en inglés)
 * solo se usa para códigos desconocidos, y en su defecto el genérico.
 */
export function getErrorMessage(errorCode: number | null, fallback?: string | null): string {
  if (errorCode !== null && errorCode in ERROR_MESSAGES) {
    return ERROR_MESSAGES[errorCode]
  }
  return fallback ?? GENERIC_MESSAGE
}

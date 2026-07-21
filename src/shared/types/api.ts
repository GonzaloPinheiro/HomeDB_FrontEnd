// CLAUDE.md §5.1: envelope estándar de todas las respuestas de la API
// (excepto descarga binaria, /healthCheck y /health). Propiedades en camelCase —
// System.Text.Json de ASP.NET Core serializa así por defecto (verificado: el
// backend no configura AddJsonOptions).
export type ApiObjResponse<T> = {
  result: boolean
  data: T | null
  errorCode: number | null
  errorMessage: string | null
}

// CLAUDE.md §5.3: los nueve módulos de la app (enum AppModules del backend)
export type AppModule =
  | 'Files'
  | 'Expenses'
  | 'Investments'
  | 'SystemMonitor'
  | 'UserManagement'
  | 'RoleManagement'
  | 'SystemLogs'
  | 'AuditLogs'
  | 'RemoteScripts'

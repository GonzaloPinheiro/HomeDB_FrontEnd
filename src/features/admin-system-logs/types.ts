import { z } from 'zod'

// Formas reales verificadas contra HomeDB.Application.DTOs.LogsDTOs.cs (julio
// 2026), camelCase en el wire (CLAUDE.md §5.1). Nota: la propiedad C# es
// `TimeStamp` (S mayúscula) tanto en LogEntryDto como en LogSlowOperationDto —
// System.Text.Json solo baja la primera letra al serializar en camelCase, así
// que el campo real en el wire es `timeStamp`, NO `timestamp` como asumía
// CLAUDE.md §5.4 antes de esta verificación (ver informe de Fase 5).
export const logEntrySchema = z.object({
  id: z.number(),
  timeStamp: z.string(),
  level: z.string(),
  source: z.string(),
  operation: z.string(),
  message: z.string(),
  exception: z.string().nullable(),
  userId: z.string(),
  correlationId: z.string(),
  durationMs: z.number(),
})
export type LogEntry = z.infer<typeof logEntrySchema>

// GetLogsResponseDto: el array de items se llama literalmente `Items` en C#
// (wire `items`), igual que GetAuditLogsResponseDto — confirmado por lectura
// directa del backend, no estaba explícito en CLAUDE.md §5.4.
export const logsPageSchema = z.object({
  items: z.array(logEntrySchema),
  totalCount: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
})
export type LogsPage = z.infer<typeof logsPageSchema>

export const logHealthSchema = z.object({
  errorsLastHour: z.number(),
  errorsLast24h: z.number(),
  warningsLast24h: z.number(),
})
export type LogHealth = z.infer<typeof logHealthSchema>

// GET /admin/logs/error-summary?hours= — LogErrorSummaryItemDto (verificado noviembre 2026).
// OJO: pese al nombre, el backend agrupa las entradas de nivel **Critical** (excepciones no
// controladas), no las de nivel Error (LogEntryRepository.GetErrorSummaryAsync).
export const errorSummaryItemSchema = z.object({
  operation: z.string(),
  count: z.number(),
})
export type ErrorSummaryItem = z.infer<typeof errorSummaryItemSchema>
export const errorSummarySchema = z.array(errorSummaryItemSchema)

// GET /admin/logs/slow-operations?thresholdMs= — LogSlowOperationDto. `timeStamp` con S
// mayúscula en C# -> wire `timeStamp`, igual que LogEntryDto (más arriba).
export const slowOperationSchema = z.object({
  operation: z.string(),
  durationMs: z.number(),
  timeStamp: z.string(),
})
export type SlowOperation = z.infer<typeof slowOperationSchema>
export const slowOperationsSchema = z.array(slowOperationSchema)

/**
 * Valores reales de `Level` que el backend escribe hoy (releído en noviembre 2026): `Information`
 * (entradas/salidas de cada operación), `Warning` (excepciones de dominio esperadas, p. ej.
 * un 404), `Error` (fallos de fondo y `AssembledFileSizeMismatch`: ExceptionHandlerMiddleware,
 * UploadCompletionQueue, UploadCleanupBackgroundService, BackupBackgroundService) y `Critical`
 * (excepción no controlada). En la auditoría de Fase 5 `Error` no aparecía en ningún punto de
 * escritura; desde entonces el backend lo usa, así que los contadores de `/health` ya no son
 * siempre 0. Lista cerrada solo para el select de filtro; el badge (levelBadge.ts) sigue siendo
 * tolerante a cualquier string por si el backend cambia.
 */
export const LOG_LEVELS = ['Information', 'Warning', 'Error', 'Critical'] as const

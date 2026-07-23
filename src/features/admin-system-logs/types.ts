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

/**
 * Valores reales de `Level` que el backend escribe hoy (verificado por lectura
 * de OperationLogScope.cs y ExceptionHandlerMiddleware.cs en la auditoría de
 * Fase 5) — NO "Info"/"Error" como sugería el comentario de LogEntry.cs en el
 * backend, que no coincide con lo que el código realmente escribe. Se usa como
 * lista cerrada solo para el select de filtro; el badge (levelBadge.ts) sigue
 * siendo tolerante a cualquier string por si el backend cambia.
 */
export const LOG_LEVELS = ['Information', 'Warning', 'Critical'] as const

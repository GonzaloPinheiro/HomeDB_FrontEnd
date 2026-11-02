import { z } from 'zod'

import { userSummarySchema } from '@/shared/types/user'

// Forma real verificada contra HomeDB.Domain.Entities.AuditLogEntry.cs (julio
// 2026) — GetAuditLogsResponseDto.Items devuelve la entidad de dominio
// DIRECTAMENTE, sin DTO propio (confirmado, CLAUDE.md §5.4 ya lo advertía).
// Wire en camelCase (§5.1). `timeStamp` (no `timestamp`): la propiedad C# es
// `TimeStamp`, System.Text.Json solo baja la primera letra al camelCase.
// A diferencia de LogEntryDto (userId: string), aquí `userId` es un número —
// es el id real de UsersDto, no un claim de string.
export const auditLogEntrySchema = z.object({
  id: z.number(),
  timeStamp: z.string(),
  userId: z.number(),
  username: z.string(),
  ipAddress: z.string().nullable(),
  action: z.string(),
  resourceType: z.string().nullable(),
  resourceId: z.number().nullable(),
  resourceName: z.string().nullable(),
})
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>

export const auditLogsPageSchema = z.object({
  items: z.array(auditLogEntrySchema),
  totalCount: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
})
export type AuditLogsPage = z.infer<typeof auditLogsPageSchema>

/**
 * Valores reales de `Action` — verificados contra
 * HomeDB.Domain.Common.AuditLogActions.cs (julio 2026, auditoría de Fase 5).
 * Clase con const strings, no un enum — lista cerrada, sí es seguro ofrecerla
 * como opciones fijas de un select (a diferencia de ResourceType, ver abajo).
 */
export const AUDIT_ACTIONS = [
  'LOGIN',
  'REGISTER',
  'LOGOUT',
  'CHANGE_PASSWORD',
  'UPLOAD_FILE',
  'DOWNLOAD_FILE',
  'DELETE_FILE',
  'CREATE_FOLDER',
  'CHANGE_FOLDER_NAME',
  'CHANGE_PARENT_FOLDER',
  'DELETE_FOLDER',
  'DELETE_USER',
  'UPDATE_PROFILE',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

/**
 * `ResourceType` NO es un enum ni una lista cerrada en el backend — es un
 * string libre (`AuditLogEntry.ResourceType: string?`), filtrado con
 * `.Contains()` (substring) en el repositorio, no comparación exacta. No
 * existe una clase de constantes equivalente a AuditLogActions para este
 * campo. En la práctica, cada punto de escritura del backend lo rellena con
 * `nameof(FileItem)`, `nameof(FolderItem)`, `nameof(User)`, o `null`
 * (ChangePassword) — son los únicos 3 valores que se producen hoy, verificado
 * grepando cada llamada a _auditService.LogAsync en el backend. Se ofrecen
 * como opciones de select por conveniencia (decisión propia, no una garantía
 * de contrato cerrado) — si el backend añade un tipo de recurso nuevo, esta
 * lista queda desactualizada hasta tocarla a mano (ver informe de Fase 5).
 */
export const AUDIT_RESOURCE_TYPES = ['FileItem', 'FolderItem', 'User'] as const

// GET /admin/users (para sugerir usuarios en el filtro, §6.24): solo se leen id y nombre. El DTO real
// (UserSummaryDto, `shared/types/user`) trae más campos; `pick` evita que un cambio en los que aquí no se
// usan rompa el filtro.
export const userSuggestionsSchema = z.object({
  users: z.array(userSummarySchema.pick({ id: true, username: true })),
})
export type UserSuggestion = z.infer<typeof userSuggestionsSchema>['users'][number]

// PROPUESTA de contrato, SIN VERIFICAR — el endpoint no existe (CLAUDE.md §5.4, §6.24):
// GET /admin/audit-logs/activity?from=&to=  ->  { daily: [{ date: "2026-11-01", count: 12 }], ... }
// `date` es un día UTC; los días sin actividad pueden venir omitidos (el front los rellena con 0). El
// contrato completo propuesto trae además `topUsers` y `topActions`; aquí solo se valida lo que el front
// consume (Zod descarta el resto).
export const auditActivitySchema = z.object({
  daily: z.array(z.object({ date: z.string(), count: z.number() })),
})
export type AuditActivity = z.infer<typeof auditActivitySchema>

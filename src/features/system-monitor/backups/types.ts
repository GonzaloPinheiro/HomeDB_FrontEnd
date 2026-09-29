import { z } from 'zod'

// Forma real verificada contra HomeDB.Domain.Entities.BackupAuditEntry,
// HomeDB.Application.DTOs.BackupDTOs y BackupController (CLAUDE.md §5.4).
//
// Los enums `BackupStatus` (Running=1, Success=2, Failed=3) y `BackupLevel`
// (Daily=1, Monthly=2) llegan hoy como NÚMERO: el backend no registra ningún
// JsonStringEnumConverter (`AddControllers()` sin opciones). Se aceptan también
// sus nombres como string por tolerancia — si el backend añade el converter
// más adelante, el front no se rompe — y se normalizan a una unión de literales
// para no propagar números mágicos por los componentes.

export type BackupStatus = 'running' | 'success' | 'failed'
export type BackupLevel = 'daily' | 'monthly'

const STATUS_BY_WIRE = {
  '1': 'running',
  Running: 'running',
  '2': 'success',
  Success: 'success',
  '3': 'failed',
  Failed: 'failed',
} as const satisfies Record<string, BackupStatus>

const LEVEL_BY_WIRE = {
  '1': 'daily',
  Daily: 'daily',
  '2': 'monthly',
  Monthly: 'monthly',
} as const satisfies Record<string, BackupLevel>

const backupStatusSchema = z
  .union([z.number(), z.string()])
  .transform((value) => String(value))
  .pipe(z.enum(Object.keys(STATUS_BY_WIRE) as [keyof typeof STATUS_BY_WIRE, ...Array<keyof typeof STATUS_BY_WIRE>]))
  .transform((wire): BackupStatus => STATUS_BY_WIRE[wire])

const backupLevelSchema = z
  .union([z.number(), z.string()])
  .transform((value) => String(value))
  .pipe(z.enum(Object.keys(LEVEL_BY_WIRE) as [keyof typeof LEVEL_BY_WIRE, ...Array<keyof typeof LEVEL_BY_WIRE>]))
  .transform((wire): BackupLevel => LEVEL_BY_WIRE[wire])

// `GET /backup/history` e `POST /backup/{level}/trigger` devuelven la entidad
// `BackupAuditEntry` directamente, no un DTO propio.
export const backupEntrySchema = z.object({
  id: z.number(),
  level: backupLevelSchema,
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  status: backupStatusSchema,
  filesBackedUpSizeBytes: z.number(),
  databaseDumpSizeBytes: z.number(),
  errorMessage: z.string().nullable(),
  backupPath: z.string().nullable(),
  // Rellena cuando la copia física fue reemplazada por la rotación (solo se
  // conservan las dos últimas): el registro sigue en el historial, la copia no.
  deletedAt: z.string().nullable(),
})
export type BackupEntry = z.infer<typeof backupEntrySchema>

export const backupHistorySchema = z.object({
  items: z.array(backupEntrySchema),
  totalCount: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
})
export type BackupHistory = z.infer<typeof backupHistorySchema>

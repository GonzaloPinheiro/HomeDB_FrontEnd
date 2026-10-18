import { z } from 'zod'

import { wireEnum } from '@/shared/lib/wireEnum'

// Formas reales de los DTOs del backend (verificadas contra FilesDtos.cs,
// FoldersDTOs.cs, StatisticsDTOs.cs y UserSettingsDTOs.cs en julio 2026),
// serializadas en camelCase (CLAUDE.md §5.1).

export const fileItemSchema = z.object({
  id: z.number(),
  fileName: z.string(),
  sizeBytes: z.number(),
  contentType: z.string(),
  folderId: z.number().nullable(),
  uploadedAt: z.string(),
})
export type FileItemDto = z.infer<typeof fileItemSchema>

export const folderSchema = z.object({
  id: z.number(),
  name: z.string(),
  parentFolderId: z.number().nullable(),
  ownerId: z.number(),
  createdAt: z.string(),
})
export type FolderDto = z.infer<typeof folderSchema>

export const uploadFileResponseSchema = z.object({
  id: z.number(),
  fileName: z.string(),
  sizeBytes: z.number(),
  contentType: z.string(),
  folderId: z.number().nullable(),
  ownerId: z.number(),
  uploadedAt: z.string(),
})

// CLAUDE.md §5.4/§7.4: subida por chunks — formas reales de UploadDTOs.cs
// (UploadController, verificado octubre 2026, tras pasar `complete` a una cola
// en background).
export const uploadInitResponseSchema = z.object({
  sessionId: z.string(),
})

/**
 * Estado de la sesión de subida en el backend (`UploadSessionStatus`:
 * InProgress=1, Completed=2, Cancelled=3, Processing=4). Llega como número —
 * ver `wireEnum`. `processing` = todos los chunks recibidos y `complete` ya
 * aceptado, ensamblando en background; `completed` y `cancelled` son terminales.
 */
export type UploadSessionStatus = 'inProgress' | 'processing' | 'completed' | 'cancelled'

const uploadSessionStatusSchema = wireEnum<UploadSessionStatus>({
  '1': 'inProgress',
  InProgress: 'inProgress',
  '4': 'processing',
  Processing: 'processing',
  '2': 'completed',
  Completed: 'completed',
  '3': 'cancelled',
  Cancelled: 'cancelled',
})

export const uploadStatusResponseSchema = z.object({
  sessionId: z.string(),
  totalChunks: z.number(),
  receivedChunks: z.number().array(),
  status: uploadSessionStatusSchema,
  // Solo con status = completed: el archivo creado por el worker.
  file: uploadFileResponseSchema.nullable(),
  // Solo con status = cancelled y fallo del ensamblado/validación: por qué falló
  // (AssembledFileSizeMismatch, InvalidFileExtension, InternalError). Una sesión
  // cancelada por superar el tamaño máximo en un chunk llega SIN código.
  errorCode: z.number().nullable(),
})
export type UploadStatusResponse = z.infer<typeof uploadStatusResponseSchema>

// POST /files/upload/{sessionId}/complete ya no devuelve el archivo: responde
// 202 con un mensaje informativo y el ensamblado ocurre en background. El
// resultado se consulta con GET /status (uploadStatusResponseSchema).
export const uploadCompleteResponseSchema = z.string()

export const deleteFileResponseSchema = z.object({
  fileId: z.number(),
  fileName: z.string(),
})

export const deleteFolderResponseSchema = z.object({
  folderId: z.number(),
  name: z.string(),
})

// StorageStatisticsResponseDto ya está en camelCase en el propio C#
export const storageStatsSchema = z.object({
  totalFiles: z.number(),
  totalFolders: z.number(),
  totalSizeBytes: z.number(),
  totalSizeMb: z.number(),
})
export type StorageStats = z.infer<typeof storageStatsSchema>

// GET /users/me/settings-overview -> UserProfileDto { settings, limits }.
// CLAUDE.md §5.5: limits.storageLimitBytes puede llegar null (sin resolver) —
// en ese caso el widget muestra solo el uso, sin comparación (§6.12).
export const settingsOverviewSchema = z.object({
  settings: z.object({
    language: z.string(),
    timezone: z.string(),
  }),
  limits: z.object({
    storageLimitBytes: z.number().nullable(),
    maxFileSizeBytes: z.number().nullable(),
  }),
})
export type SettingsOverview = z.infer<typeof settingsOverviewSchema>

/** Un segmento del breadcrumb — usado por Breadcrumb.tsx, FileExplorerPage y useFolderPath. */
export type Crumb = {
  id: number | null
  name: string
}

/**
 * CLAUDE.md §6.3: lista única de carpetas y archivos. Modelo unificado para la
 * fila del explorador; `createdAt` normaliza uploadedAt/createdAt para ordenar.
 */
export type ExplorerItem =
  | { kind: 'folder'; id: number; name: string; createdAt: string; parentFolderId: number | null }
  | {
      kind: 'file'
      id: number
      name: string
      createdAt: string
      sizeBytes: number
      contentType: string
      folderId: number | null
    }

export function toExplorerFolder(dto: FolderDto): ExplorerItem {
  return {
    kind: 'folder',
    id: dto.id,
    name: dto.name,
    createdAt: dto.createdAt,
    parentFolderId: dto.parentFolderId,
  }
}

export function toExplorerFile(dto: FileItemDto): ExplorerItem {
  return {
    kind: 'file',
    id: dto.id,
    name: dto.fileName,
    createdAt: dto.uploadedAt,
    sizeBytes: dto.sizeBytes,
    contentType: dto.contentType,
    folderId: dto.folderId,
  }
}

import { z } from 'zod'

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

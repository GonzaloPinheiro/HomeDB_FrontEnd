import { z } from 'zod'

import { wireEnum } from '@/shared/lib/wireEnum'

// Forma real verificada contra HomeDB.Application.DTOs.StorageDTOs.cs
// (`StorageLocationStatusDto`), StorageStatusService y StorageController en la rama
// `development` del backend (noviembre 2026) — CLAUDE.md §5.4.
//
// `usage` (`LocationUsage`: Personal=1, Media=2, Temp=3, Backups=4) llega como NÚMERO: el
// backend no registra ningún JsonStringEnumConverter. Se acepta también el nombre como
// string por tolerancia, y se normaliza a una unión de literales (`wireEnum`, shared/lib).

export type LocationUsage = 'personal' | 'media' | 'temp' | 'backups'

const USAGE_BY_WIRE = {
  '1': 'personal',
  Personal: 'personal',
  '2': 'media',
  Media: 'media',
  '3': 'temp',
  Temp: 'temp',
  '4': 'backups',
  Backups: 'backups',
} as const satisfies Record<string, LocationUsage>

// Una fila por UBICACIÓN, no por disco: las de un mismo disco REPITEN disponibilidad y cifras
// (`groupByDisk` las agrupa). Los tres `*Bytes` son `null` si el disco no está disponible —y
// también si cayó justo entre la comprobación de disponibilidad y la lectura de capacidad,
// con `isAvailable: true`—: `null` = "sin dato", nunca 0.
export const storageLocationSchema = z.object({
  locationKey: z.string(),
  diskKey: z.string(),
  usage: wireEnum<LocationUsage>(USAGE_BY_WIRE),
  isDefault: z.boolean(),
  isAvailable: z.boolean(),
  isWritable: z.boolean(),
  reason: z.string().nullable(),
  checkedAtUtc: z.string(),
  totalBytes: z.number().nullable(),
  usedBytes: z.number().nullable(),
  freeBytes: z.number().nullable(),
  // Límite del DISCO (0 = desactivado), no de la ubicación.
  minFreeBytes: z.number(),
  // Tope de la UBICACIÓN (null = sin tope); solo se admite en las de uso Personal.
  maxUsedBytes: z.number().nullable(),
})
export type StorageLocation = z.infer<typeof storageLocationSchema>

export const storageLocationsSchema = z.array(storageLocationSchema)

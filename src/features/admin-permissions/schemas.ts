import { z } from 'zod'

import type { UserLimits } from './types'

// CLAUDE.md fase 4b, punto 4: el formulario trabaja en GB/MB (unidad visible),
// la conversión a bytes ocurre solo al leer/enviar (mismas bases que
// shared/lib/formatBytes.ts, que también usa 1024 progresivo).
export const BYTES_PER_GB = 1024 ** 3
export const BYTES_PER_MB = 1024 ** 2

// Campos de texto (no type=number) para no pelear con la coerción del propio
// input — mismo criterio que el resto de formularios de la app. Vacío = sin
// override propio (null en el DTO, cae al límite global del servidor).
const optionalPositiveAmount = z
  .string()
  .refine((value) => value.trim() === '' || (Number(value) > 0 && Number.isFinite(Number(value))), {
    message: 'Debe ser un número positivo',
  })

export const limitsFormSchema = z.object({
  storageLimitGb: optionalPositiveAmount,
  maxFileSizeMb: optionalPositiveAmount,
})
export type LimitsFormValues = z.infer<typeof limitsFormSchema>

/** Bytes (o null) -> texto del formulario ("" cuando no hay override propio). */
export function limitsToFormValues(limits: UserLimits): LimitsFormValues {
  return {
    storageLimitGb: limits.storageLimitBytes != null ? String(limits.storageLimitBytes / BYTES_PER_GB) : '',
    maxFileSizeMb: limits.maxFileSizeBytes != null ? String(limits.maxFileSizeBytes / BYTES_PER_MB) : '',
  }
}

/** Texto del formulario -> bytes (o null) para el PATCH. */
export function formValuesToLimits(values: LimitsFormValues): UserLimits {
  return {
    storageLimitBytes: values.storageLimitGb.trim() === '' ? null : Math.round(Number(values.storageLimitGb) * BYTES_PER_GB),
    maxFileSizeBytes: values.maxFileSizeMb.trim() === '' ? null : Math.round(Number(values.maxFileSizeMb) * BYTES_PER_MB),
  }
}

import { z } from 'zod'

// Forma real verificada contra HomeDB.Application.DTOs.SystemMetricsDTOs.cs y
// HomeDB.Domain.Entities.SystemMetricsEntry.cs (Fase 6, julio 2026). `Timestamp`
// es el ÚNICO campo no-nullable; los otros doce sí lo son (un sensor puede
// fallar) — memoria y disco llegan con las dos representaciones a la vez
// (bytes en crudo + porcentaje ya calculado por el backend, sin derivarlo aquí).
export const systemMetricsSchema = z.object({
  timestamp: z.string(),
  cpuUsagePercent: z.number().nullable(),
  memoryTotalBytes: z.number().nullable(),
  memoryUsedBytes: z.number().nullable(),
  memoryUsagePercent: z.number().nullable(),
  diskTotalBytes: z.number().nullable(),
  diskUsedBytes: z.number().nullable(),
  diskUsagePercent: z.number().nullable(),
  temperatureCelsius: z.number().nullable(),
  fanIsRunning: z.boolean().nullable(),
  fanRpmSpeed: z.number().nullable(),
  fanPwmDutyCycle: z.number().nullable(),
  fanControlMode: z.string().nullable(),
})
export type SystemMetrics = z.infer<typeof systemMetricsSchema>

export const metricsHistorySchema = z.array(systemMetricsSchema)

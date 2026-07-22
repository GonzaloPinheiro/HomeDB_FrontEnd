import { z } from 'zod'

// Reexportado desde usePermissions (§7.3): mismo DTO (UserModulePermissionsResponseDto,
// 9 flags) que "Mis permisos", solo que aquí se consulta/edita el de OTRO
// usuario — no duplicar la forma del objeto en dos sitios.
export { permissionsSchema, type ModulePermissions } from '@/shared/hooks/usePermissions'

// UserAdminSettingsResponseDto — verificado contra UserSettingsDTOs.cs y
// UserAdminSettingsService.cs (julio 2026). Ambos campos son nullable (long?):
// `null` significa que el usuario no tiene override propio y se aplica el
// límite global de appsettings (StorageOptions) en tiempo de uso real (subida
// de archivos) — pero ese valor global NO está expuesto por ningún endpoint
// cuando un Admin edita a OTRO usuario (solo /users/me/settings-overview
// resuelve el propio, vía GetEffectiveSettingsAsync), así que el front no
// puede comparar contra el número real del límite global en este modal (ver
// nota en LimitsTab).
export const userLimitsSchema = z.object({
  storageLimitBytes: z.number().nullable(),
  maxFileSizeBytes: z.number().nullable(),
})
export type UserLimits = z.infer<typeof userLimitsSchema>

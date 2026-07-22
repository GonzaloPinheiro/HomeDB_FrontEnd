import { z } from 'zod'

// Formas reales verificadas contra UsersDtos.cs y UserSettingsDTOs.cs
// (julio 2026), camelCase en el wire (CLAUDE.md §5.1)

// GET /users/me (fase de integración) devuelve el mismo UserSummaryDto que
// GET /admin/users/{id} — UsersController.GetOwnUserAsync reutiliza
// _usersService.GetUserByIdAsync, el mismo método. Reexportado desde
// shared/types/user.ts para no duplicar la forma del DTO (lo usan también
// admin-users/ y admin-permissions/).
export { userSummarySchema, type UserSummary } from '@/shared/types/user'

export const updateProfileResponseSchema = z.object({
  userId: z.number(),
  username: z.string(),
  email: z.string(),
})
export type UpdateProfileResponse = z.infer<typeof updateProfileResponseSchema>

export const userSettingsSchema = z.object({
  language: z.string(),
  timezone: z.string(),
})
export type UserSettings = z.infer<typeof userSettingsSchema>

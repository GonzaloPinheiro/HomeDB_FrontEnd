import { z } from 'zod'

// Formas reales verificadas contra UsersDtos.cs y UserSettingsDTOs.cs
// (julio 2026), camelCase en el wire (CLAUDE.md §5.1)

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

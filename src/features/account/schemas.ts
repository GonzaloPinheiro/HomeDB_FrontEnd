import { z } from 'zod'

// CLAUDE.md §7.6: schemas de formularios junto a la feature

export const profileSchema = z.object({
  username: z.string().trim().min(1, 'Escribe un nombre de usuario'),
  // Vacío = no cambiar el email (no hay endpoint para leer el email actual)
  email: z.email('No parece un email válido').or(z.literal('')),
})
export type ProfileValues = z.infer<typeof profileSchema>

// El backend solo exige que no estén vacías (verificado: ChangePasswordRequestDto
// con [Required] y sin más validación en AuthService) — no inventamos requisitos
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Escribe tu contraseña actual'),
  newPassword: z.string().min(1, 'Escribe la contraseña nueva'),
})
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>

export const settingsSchema = z.object({
  language: z.string().min(1),
  timezone: z.string().trim().min(1, 'Escribe una zona horaria'),
})
export type SettingsValues = z.infer<typeof settingsSchema>

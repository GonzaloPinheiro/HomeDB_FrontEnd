import { z } from 'zod'

// CLAUDE.md §7.6: schema del formulario de "Nuevo usuario". RegisterDto solo
// admite Username y Password (sin email, §5.4); el backend no impone requisitos
// de contraseña más allá de no-vacía (verificado en Fase 3).
export const createUserSchema = z.object({
  username: z.string().trim().min(1, 'Escribe un nombre de usuario'),
  password: z.string().min(1, 'Escribe una contraseña'),
})
export type CreateUserValues = z.infer<typeof createUserSchema>

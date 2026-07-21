import { z } from 'zod'

// CLAUDE.md §7.6: el schema del formulario vive junto al formulario en su feature
export const loginSchema = z.object({
  username: z.string().min(1, 'Escribe tu nombre de usuario'),
  password: z.string().min(1, 'Escribe tu contraseña'),
})

export type LoginFormValues = z.infer<typeof loginSchema>

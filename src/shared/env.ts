import { z } from 'zod'

// CLAUDE.md §7.7: un único VITE_API_URL validado al arrancar — si falta o es
// inválido, la app falla de forma clara al inicio, no de forma rara en la
// primera request.
export const envSchema = z.object({
  VITE_API_URL: z.url(),
})

export const env = envSchema.parse({
  VITE_API_URL: import.meta.env.VITE_API_URL,
})

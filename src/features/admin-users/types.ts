import { z } from 'zod'

// Formas reales verificadas contra UsersDtos.cs y AuthDtos.cs (julio 2026),
// camelCase en el wire (CLAUDE.md §5.1)

export const userSummarySchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string(),
  createdAt: z.string(),
  // El backend expone una LISTA de roles por usuario (aunque hoy solo asigna uno)
  roles: z.array(z.string()),
})
export type UserSummary = z.infer<typeof userSummarySchema>

export const usersPageSchema = z.object({
  users: z.array(userSummarySchema),
  totalCount: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
})
export type UsersPage = z.infer<typeof usersPageSchema>

export const createdUserSchema = z.object({
  id: z.number(),
  username: z.string(),
  createdAt: z.string(),
})

export const deleteUserResponseSchema = z.object({
  userId: z.number(),
  username: z.string(),
})

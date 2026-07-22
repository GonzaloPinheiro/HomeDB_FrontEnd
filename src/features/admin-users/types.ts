import { z } from 'zod'

import { userSummarySchema } from '@/shared/types/user'

// Formas reales verificadas contra UsersDtos.cs y AuthDtos.cs (julio 2026),
// camelCase en el wire (CLAUDE.md §5.1)

// Reexportado desde shared/types/user.ts: lo consumen también account/ (GET
// /users/me) y admin-permissions/ (Perfil), no solo esta feature.
export { userSummarySchema, type UserSummary } from '@/shared/types/user'

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

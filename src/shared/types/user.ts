import { z } from 'zod'

// UserSummaryDto — verificado contra UsersDtos.cs (julio 2026), camelCase en
// el wire (CLAUDE.md §5.1). Antes vivía solo en features/admin-users/types.ts,
// pero GET /users/me (fase de integración) reutiliza EXACTAMENTE el mismo DTO
// (UsersController.GetOwnUserAsync llama a _usersService.GetUserByIdAsync, el
// mismo método que GET /admin/users/{id}) — con account/ y admin-permissions/
// consumiéndolo además de admin-users/, sube a shared/ en vez de copiarlo.
export const userSummarySchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string(),
  createdAt: z.string(),
  // El backend expone una LISTA de roles por usuario (aunque hoy solo asigna uno)
  roles: z.array(z.string()),
})
export type UserSummary = z.infer<typeof userSummarySchema>

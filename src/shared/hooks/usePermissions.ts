import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { api, unwrap } from '@/shared/api/client'
import { useAuth } from '@/shared/hooks/useAuth'
import type { ApiObjResponse, AppModule } from '@/shared/types/api'

// Forma real de UserModulePermissionsResponseDto (9 flags), en camelCase.
// Exportado: lo reutiliza features/admin-permissions (Fase 4b) para no
// duplicar la forma del mismo DTO cuando un Admin edita los permisos de OTRO
// usuario en vez de los propios.
export const permissionsSchema = z.object({
  filesEnabled: z.boolean(),
  expensesEnabled: z.boolean(),
  investmentsEnabled: z.boolean(),
  systemMonitorEnabled: z.boolean(),
  userManagementEnabled: z.boolean(),
  roleManagementEnabled: z.boolean(),
  systemLogsEnabled: z.boolean(),
  auditLogsEnabled: z.boolean(),
  remoteScriptsEnabled: z.boolean(),
})

export type ModulePermissions = z.infer<typeof permissionsSchema>

// Exportado por el mismo motivo que permissionsSchema: admin-permissions
// (Fase 4b) necesita iterar ALL_MODULES -> nombre de flag real para pintar y
// editar el grid de switches de OTRO usuario.
export const MODULE_FLAG: Record<AppModule, keyof ModulePermissions> = {
  Files: 'filesEnabled',
  Expenses: 'expensesEnabled',
  Investments: 'investmentsEnabled',
  SystemMonitor: 'systemMonitorEnabled',
  UserManagement: 'userManagementEnabled',
  RoleManagement: 'roleManagementEnabled',
  SystemLogs: 'systemLogsEnabled',
  AuditLogs: 'auditLogsEnabled',
  RemoteScripts: 'remoteScriptsEnabled',
}

/**
 * Lógica pura de acceso a módulo, extraída para poder testearla (§9).
 * CLAUDE.md §7.3: si isAdmin, true SIEMPRE sin mirar los flags — replica el
 * bypass del backend (§5.3).
 */
export function resolveHasModule(
  isAdmin: boolean,
  permissions: ModulePermissions | undefined,
  module: AppModule,
): boolean {
  if (isAdmin) return true
  return permissions?.[MODULE_FLAG[module]] ?? false
}

export function usePermissions() {
  const { claims, isAuthenticated } = useAuth()
  const isAdmin = claims?.role === 'Admin'

  const query = useQuery({
    queryKey: ['permissions', 'me'],
    queryFn: async () => {
      const response = await api.get<ApiObjResponse<unknown>>('/users/me/permissions')
      return permissionsSchema.parse(unwrap(response.data))
    },
    // §7.3: para un Admin los flags ni siquiera se consultan
    enabled: isAuthenticated && !isAdmin,
    staleTime: 5 * 60_000,
  })

  return {
    isAdmin,
    hasModule: (module: AppModule) => resolveHasModule(isAdmin, query.data, module),
    /** true mientras los flags aún no están disponibles (solo aplica a no-admins). */
    isLoading: isAuthenticated && !isAdmin && query.isPending,
  }
}

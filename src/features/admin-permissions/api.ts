import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { api, toApiError, unwrap } from '@/shared/api/client'
import { permissionsSchema, type ModulePermissions } from '@/shared/hooks/usePermissions'
import type { ApiObjResponse } from '@/shared/types/api'

import { userLimitsSchema, type UserLimits } from './types'

// Claves por userId (punto 2 del prompt de fase 4b): abrir el modal de un
// usuario y luego el de otro no debe servir datos cruzados de caché.
export const adminPermissionsKeys = {
  permissions: (userId: number) => ['admin-permissions', 'permissions', userId] as const,
  limits: (userId: number) => ['admin-permissions', 'limits', userId] as const,
}

/**
 * GET /admin/users/{id}/permissions — Admin + módulo (verificado en
 * UsersModulePermissionsController). `targetIsAdmin` replica exactamente el
 * bypass de CLAUDE.md §7.3, pero para OTRO usuario en vez de "mí mismo": un
 * Admin puede no tener fila de permisos en BD, así que la query ni se dispara
 * cuando el usuario objetivo es Admin.
 */
export function useUserPermissions(userId: number, targetIsAdmin: boolean) {
  return useQuery({
    queryKey: adminPermissionsKeys.permissions(userId),
    queryFn: async () => {
      const response = await api.get<ApiObjResponse<unknown>>(`/admin/users/${userId}/permissions`)
      return permissionsSchema.parse(unwrap(response.data))
    },
    enabled: !targetIsAdmin,
  })
}

/**
 * PATCH /admin/users/{id}/permissions — Admin + módulo. Verificado contra
 * UserModulePermissionsService.UpdatePermissionsAsync: NO hace upsert, si el
 * usuario objetivo no tiene fila de permisos (caso raro, solo con usuarios
 * insertados a mano en BD, igual que el hueco de §5.5) el PATCH falla con
 * PermissionsNotFound (1014) igual que el GET — no hay forma de crear la fila
 * desde aquí.
 */
export function useUpdateUserPermissions(userId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (changes: Partial<ModulePermissions>) => {
      const response = await api.patch<ApiObjResponse<unknown>>(`/admin/users/${userId}/permissions`, changes)
      return permissionsSchema.parse(unwrap(response.data))
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminPermissionsKeys.permissions(userId) })
      toast.success('Permisos actualizados')
    },
    onError: (error) => toast.error(toApiError(error).message),
  })
}

/**
 * GET /admin/users/{id}/settings — solo módulo, sin exigir rol Admin (§5.4).
 * Verificado contra UserAdminSettingsService.GetAdminSettingsAsync: se
 * comporta EXACTAMENTE igual que permisos ante una fila ausente (404
 * UserSettingsNotFound=1015, no upsert ni valores nulos de relleno) — el caso
 * "null" de §5.5 es la fila EXISTENTE con columnas sin override, no una fila
 * inexistente.
 */
export function useUserLimits(userId: number) {
  return useQuery({
    queryKey: adminPermissionsKeys.limits(userId),
    queryFn: async () => {
      const response = await api.get<ApiObjResponse<unknown>>(`/admin/users/${userId}/settings`)
      return userLimitsSchema.parse(unwrap(response.data))
    },
  })
}

/**
 * PATCH /admin/users/{id}/settings. A diferencia de permisos, verificado
 * contra UserAdminSettingsService.UpdateAdminSettingsAsync que este endpoint
 * NO respeta ausencia de campo por campo (no hay `.HasValue` por propiedad):
 * siempre sobreescribe AMBOS campos con lo recibido, null incluido. Por eso
 * `changes` exige los dos valores completos (nunca un parcial) — omitir uno
 * lo pondría a null y borraría silenciosamente su override.
 */
export function useUpdateUserLimits(userId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (changes: UserLimits) => {
      const response = await api.patch<ApiObjResponse<unknown>>(`/admin/users/${userId}/settings`, changes)
      return userLimitsSchema.parse(unwrap(response.data))
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminPermissionsKeys.limits(userId) })
      toast.success('Límites actualizados')
    },
    onError: (error) => toast.error(toApiError(error).message),
  })
}

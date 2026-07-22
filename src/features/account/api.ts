import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { api, toApiError, unwrap } from '@/shared/api/client'
import { useAuth } from '@/shared/hooks/useAuth'
import type { ApiObjResponse } from '@/shared/types/api'

import { updateProfileResponseSchema, userSettingsSchema, userSummarySchema, type UserSummary } from './types'

const settingsKey = ['account', 'settings'] as const
const myProfileKey = ['account', 'profile'] as const

/**
 * GET /users/me (fase de integración) — UsersController.GetOwnUserAsync,
 * verificado contra el código real: reutiliza el mismo UserSummaryDto que
 * GET /admin/users/{id}. Antes no existía ningún GET para leer el propio
 * perfil (§5.4) — AccountSettingsPage (Fase 3) precargaba solo el username
 * desde el claim del JWT y trataba el email vacío como "no cambiar" porque no
 * había de dónde traerlo. Ahora sí hay de dónde: se usa para precargar el
 * formulario de Perfil con los valores reales.
 */
export function useMyProfile() {
  return useQuery({
    queryKey: myProfileKey,
    queryFn: async () => {
      const response = await api.get<ApiObjResponse<unknown>>('/users/me')
      return userSummarySchema.parse(unwrap(response.data))
    },
  })
}

/**
 * PATCH /users/me. Enviar SOLO los campos modificados: el backend comprueba la
 * existencia del username/email sin excluir al propio usuario (verificado en
 * UsersService.UpdateProfileAsync) — reenviar el username actual sin cambios
 * fallaría con UserAlreadyExists (1007). Con GET /users/me ya disponible, el
 * formulario compara contra el valor REAL cargado (no contra el claim del
 * JWT, que podría estar desactualizado) para decidir qué contar como "cambio".
 */
export function useUpdateProfile() {
  const { updateUsername } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (changes: { username?: string; email?: string }) => {
      const response = await api.patch<ApiObjResponse<unknown>>('/users/me', changes)
      return updateProfileResponseSchema.parse(unwrap(response.data))
    },
    onSuccess: (profile) => {
      // La cabecera refleja el nombre nuevo al instante, sin esperar al
      // siguiente refresh de token
      updateUsername(profile.username)
      // Refleja el cambio en la caché de useMyProfile sin esperar un refetch —
      // UpdateProfileResponseDto no trae createdAt/roles, así que se mezcla
      // sobre lo que ya había en vez de reemplazarlo entero.
      queryClient.setQueryData(myProfileKey, (current: UserSummary | undefined) =>
        current ? { ...current, username: profile.username, email: profile.email } : current,
      )
    },
    // Sin toast de error: 1007/1011 se muestran junto al campo (el formulario decide)
  })
}

/**
 * PUT /auth/changePassword. CLAUDE.md §5.2: el backend revoca todos los refresh
 * tokens — al tener éxito se fuerza logout con mensaje explicativo en /login.
 */
export function useChangePassword() {
  const { logout } = useAuth()
  return useMutation({
    mutationFn: async (body: { oldPassword: string; newPassword: string }) => {
      unwrap((await api.put<ApiObjResponse<null>>('/auth/changePassword', body)).data)
    },
    onSuccess: () => {
      void logout('Sesión cerrada por seguridad tras cambiar la contraseña. Entra con la nueva.')
    },
    // Sin toast: InvalidCredentials (1006) se muestra junto al campo de contraseña actual
  })
}

export function useAccountSettings() {
  return useQuery({
    queryKey: settingsKey,
    queryFn: async () => {
      const response = await api.get<ApiObjResponse<unknown>>('/users/me/settings')
      return userSettingsSchema.parse(unwrap(response.data))
    },
  })
}

export function useUpdateAccountSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (changes: { language?: string; timezone?: string }) => {
      const response = await api.patch<ApiObjResponse<unknown>>('/users/me/settings', changes)
      return userSettingsSchema.parse(unwrap(response.data))
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsKey, settings)
      toast.success('Ajustes guardados')
    },
    onError: (error) => toast.error(toApiError(error).message),
  })
}

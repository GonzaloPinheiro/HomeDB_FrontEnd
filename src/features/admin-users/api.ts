import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { api, toApiError, unwrap } from '@/shared/api/client'
import type { ApiObjResponse } from '@/shared/types/api'

import { splitSearchTerm } from './search'
import { createdUserSchema, deleteUserResponseSchema, usersPageSchema } from './types'

export const USERS_PAGE_SIZE = 20

export type UsersFilters = {
  search: string
  role: string | null
  from: string | null
  to: string | null
}

export const EMPTY_FILTERS: UsersFilters = { search: '', role: null, from: null, to: null }

// La clave incluye TODOS los filtros y la página: cada combinación cachea por
// separado, sin servir resultados cruzados entre búsquedas distintas
export const usersKeys = {
  all: ['admin-users'] as const,
  list: (filters: UsersFilters, page: number) => ['admin-users', 'list', filters, page] as const,
}

export function useUsers(filters: UsersFilters, page: number) {
  return useQuery({
    queryKey: usersKeys.list(filters, page),
    queryFn: async () => {
      const { userName, email } = splitSearchTerm(filters.search)
      const response = await api.get<ApiObjResponse<unknown>>('/admin/users', {
        params: {
          userName,
          email,
          roleName: filters.role ?? undefined,
          from: filters.from ?? undefined,
          to: filters.to ?? undefined,
          page,
          pageSize: USERS_PAGE_SIZE,
        },
      })
      return usersPageSchema.parse(unwrap(response.data))
    },
    // Mantiene la página anterior visible mientras llega la nueva (sin saltos)
    placeholderData: keepPreviousData,
  })
}

/** POST /auth/register — solo rol Admin (§5.2): la creación de usuarios vive aquí, no en login. */
export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { username: string; password: string }) => {
      const response = await api.post<ApiObjResponse<unknown>>('/auth/register', body)
      return createdUserSchema.parse(unwrap(response.data))
    },
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: usersKeys.all })
      toast.success(`Usuario "${user.username}" creado`)
    },
    // Sin toast de error: 1007 se muestra junto al campo username (el modal decide)
  })
}

/**
 * DELETE /admin/users/{id} — rol Admin + módulo (verificado en UsersController).
 * Falla con UserHasAssociatedData (1017) si tiene archivos O carpetas — sin
 * borrado en cascada (§5.4); y con Unauthorized (1003) si el objetivo es otro
 * Admin (un Admin solo puede eliminarse a sí mismo, regla del backend).
 */
export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: number) => {
      const response = await api.delete<ApiObjResponse<unknown>>(`/admin/users/${userId}`)
      return deleteUserResponseSchema.parse(unwrap(response.data))
    },
    onSuccess: (deleted) => {
      void queryClient.invalidateQueries({ queryKey: usersKeys.all })
      toast.success(`Usuario "${deleted.username}" eliminado`)
    },
    onError: (error) => toast.error(toApiError(error).message),
  })
}

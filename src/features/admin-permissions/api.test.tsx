import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/shared/api/client'
import type { ModulePermissions } from '@/shared/hooks/usePermissions'
import type { ApiObjResponse } from '@/shared/types/api'

import {
  adminPermissionsKeys,
  useUpdateUserLimits,
  useUpdateUserPermissions,
  useUserLimits,
  useUserPermissions,
} from './api'
import type { UserLimits } from './types'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

function envelope<T>(data: T): ApiObjResponse<T> {
  return { result: true, data, errorCode: null, errorMessage: null }
}

const ALL_FALSE: ModulePermissions = {
  filesEnabled: false,
  expensesEnabled: false,
  investmentsEnabled: false,
  systemMonitorEnabled: false,
  userManagementEnabled: false,
  roleManagementEnabled: false,
  systemLogsEnabled: false,
  auditLogsEnabled: false,
  remoteScriptsEnabled: false,
}

const NO_LIMITS: UserLimits = { storageLimitBytes: null, maxFileSizeBytes: null }

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useUserPermissions — bypass de Admin (CLAUDE.md §7.3, para OTRO usuario)', () => {
  it('si el usuario objetivo es Admin, la query NUNCA se dispara (puede no tener fila en BD)', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: envelope(ALL_FALSE) })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    const { result } = renderHook(() => useUserPermissions(5, true), { wrapper: makeWrapper(queryClient) })

    // Da tiempo a que un posible fetch se dispare antes de comprobar que no lo hizo
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(result.current.isPending).toBe(true)
    expect(getSpy).not.toHaveBeenCalled()
  })

  it('si el usuario objetivo NO es Admin, la query se dispara contra su endpoint', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: envelope(ALL_FALSE) })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    const { result } = renderHook(() => useUserPermissions(5, false), { wrapper: makeWrapper(queryClient) })

    await waitFor(() => expect(result.current.data).toEqual(ALL_FALSE))
    expect(getSpy).toHaveBeenCalledWith('/admin/users/5/permissions')
  })
})

describe('Invalidación de caché por userId (punto 5/6 de la fase 4b)', () => {
  it('useUpdateUserPermissions invalida SOLO la query de permisos de ese userId, no la de otro usuario', async () => {
    vi.spyOn(api, 'patch').mockResolvedValue({ data: envelope(ALL_FALSE) })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(adminPermissionsKeys.permissions(1), ALL_FALSE)
    queryClient.setQueryData(adminPermissionsKeys.permissions(2), ALL_FALSE)

    const { result } = renderHook(() => useUpdateUserPermissions(1), { wrapper: makeWrapper(queryClient) })
    await result.current.mutateAsync({ filesEnabled: true })

    expect(queryClient.getQueryState(adminPermissionsKeys.permissions(1))?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(adminPermissionsKeys.permissions(2))?.isInvalidated).toBe(false)
  })

  it('useUpdateUserLimits invalida SOLO la query de límites de ese userId, no la de otro usuario', async () => {
    vi.spyOn(api, 'patch').mockResolvedValue({ data: envelope(NO_LIMITS) })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(adminPermissionsKeys.limits(1), NO_LIMITS)
    queryClient.setQueryData(adminPermissionsKeys.limits(2), NO_LIMITS)

    const { result } = renderHook(() => useUpdateUserLimits(1), { wrapper: makeWrapper(queryClient) })
    await result.current.mutateAsync({ storageLimitBytes: 1_000, maxFileSizeBytes: 500 })

    expect(queryClient.getQueryState(adminPermissionsKeys.limits(1))?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(adminPermissionsKeys.limits(2))?.isInvalidated).toBe(false)
  })

  it('las claves de permisos y límites del mismo userId no se pisan entre sí', () => {
    expect(JSON.stringify(adminPermissionsKeys.permissions(1))).not.toBe(
      JSON.stringify(adminPermissionsKeys.limits(1)),
    )
  })
})

describe('useUserLimits', () => {
  it('consulta GET /admin/users/{id}/settings', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: envelope(NO_LIMITS) })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    const { result } = renderHook(() => useUserLimits(7), { wrapper: makeWrapper(queryClient) })

    await waitFor(() => expect(result.current.data).toEqual(NO_LIMITS))
    expect(getSpy).toHaveBeenCalledWith('/admin/users/7/settings')
  })
})

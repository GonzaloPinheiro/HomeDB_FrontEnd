import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useEffect, type ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/shared/api/client'
import { AuthProvider, useAuth } from '@/shared/hooks/useAuth'
import type { ApiObjResponse } from '@/shared/types/api'

import { useChangePassword, useMyProfile, useUpdateProfile } from './api'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

function envelope<T>(data: T): ApiObjResponse<T> {
  return { result: true, data, errorCode: null, errorMessage: null }
}

const ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'

function fakeJwt(username: string): string {
  const b64 = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_')
  return `${b64({ alg: 'HS256' })}.${b64({ userId: '7', username, [ROLE_CLAIM]: 'User' })}.firma`
}

// Registra cada pathname visitado para poder afirmar la navegación a /login
const visited: Array<{ pathname: string; state: unknown }> = []
function LocationSpy() {
  const location = useLocation()
  useEffect(() => {
    visited.push({ pathname: location.pathname, state: location.state })
  }, [location])
  return null
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/account/settings']}>
        <AuthProvider>
          <LocationSpy />
          {children}
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// La restauración de sesión del AuthProvider hace POST /auth/refreshToken al
// montar: se resuelve con un token falso para arrancar autenticado como "ana"
function mockSessionRestore() {
  vi.spyOn(api, 'post').mockResolvedValue({
    data: envelope({
      accessToken: fakeJwt('ana'),
      accessTokenExpiresAt: '2026-12-31T00:00:00Z',
      refreshToken: 'x',
      refreshTokenExpiresAt: '2026-12-31T00:00:00Z',
    }),
  })
}

describe('features/account/api', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    visited.length = 0
  })

  it('useUpdateProfile actualiza el username de useAuth tras éxito (cabecera al día sin refresh)', async () => {
    mockSessionRestore()
    vi.spyOn(api, 'patch').mockResolvedValue({
      data: envelope({ userId: 7, username: 'ana-nueva', email: 'ana@example.com' }),
    })

    const { result } = renderHook(() => ({ auth: useAuth(), update: useUpdateProfile() }), { wrapper })
    await waitFor(() => expect(result.current.auth.claims?.username).toBe('ana'))

    await result.current.update.mutateAsync({ username: 'ana-nueva' })

    await waitFor(() => expect(result.current.auth.claims?.username).toBe('ana-nueva'))
    expect(api.patch).toHaveBeenCalledWith('/users/me', { username: 'ana-nueva' })
  })

  // Fase de integración: GET /users/me existe (UsersController.GetOwnUserAsync).
  it('useMyProfile consulta GET /users/me; useUpdateProfile parchea su caché sin refetch tras guardar', async () => {
    mockSessionRestore()
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({
      data: envelope({
        id: 7,
        username: 'ana',
        email: 'ana@example.com',
        createdAt: '2026-01-01T00:00:00Z',
        roles: ['User'],
      }),
    })
    vi.spyOn(api, 'patch').mockResolvedValue({
      data: envelope({ userId: 7, username: 'ana-nueva', email: 'ana-nueva@example.com' }),
    })

    const { result } = renderHook(() => ({ profile: useMyProfile(), update: useUpdateProfile() }), { wrapper })
    await waitFor(() => expect(result.current.profile.data?.username).toBe('ana'))
    expect(getSpy).toHaveBeenCalledWith('/users/me')

    await result.current.update.mutateAsync({ username: 'ana-nueva', email: 'ana-nueva@example.com' })

    await waitFor(() => expect(result.current.profile.data?.username).toBe('ana-nueva'))
    expect(result.current.profile.data?.email).toBe('ana-nueva@example.com')
    // id/createdAt/roles se conservan del fetch original: UpdateProfileResponseDto no los trae
    expect(result.current.profile.data?.id).toBe(7)
    expect(result.current.profile.data?.roles).toEqual(['User'])
    expect(getSpy).toHaveBeenCalledTimes(1) // caché parcheada, sin refetch
  })

  it('useChangePassword fuerza logout y navega a /login con el mensaje explicativo', async () => {
    mockSessionRestore()
    vi.spyOn(api, 'put').mockResolvedValue({ data: envelope(null) })

    const { result } = renderHook(() => ({ auth: useAuth(), change: useChangePassword() }), { wrapper })
    await waitFor(() => expect(result.current.auth.isAuthenticated).toBe(true))

    await result.current.change.mutateAsync({ oldPassword: 'vieja', newPassword: 'nueva' })

    await waitFor(() => expect(result.current.auth.isAuthenticated).toBe(false))
    // logout() llamó al endpoint y navegó a /login con el mensaje (§5.2)
    expect(api.post).toHaveBeenCalledWith('/auth/logout', { refreshToken: '' })
    const last = visited[visited.length - 1]
    expect(last.pathname).toBe('/login')
    expect(last.state).toMatchObject({ message: expect.stringContaining('contraseña') })
  })
})

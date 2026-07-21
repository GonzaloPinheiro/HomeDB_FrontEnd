import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { AuthClaims } from '@/shared/lib/jwt'
import type { AppModule } from '@/shared/types/api'

import { resolveHasModule, usePermissions, type ModulePermissions } from './usePermissions'

// El estado de auth se controla por test reasignando mockAuth
let mockAuth: { claims: AuthClaims | null; isAuthenticated: boolean }
vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: () => mockAuth,
}))

const ALL_MODULES: AppModule[] = [
  'Files',
  'Expenses',
  'Investments',
  'SystemMonitor',
  'UserManagement',
  'RoleManagement',
  'SystemLogs',
  'AuditLogs',
  'RemoteScripts',
]

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

function renderPermissions(cachedFlags?: ModulePermissions) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  if (cachedFlags) {
    queryClient.setQueryData(['permissions', 'me'], cachedFlags)
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => usePermissions(), { wrapper })
}

describe('usePermissions (CLAUDE.md §7.3)', () => {
  it('bypass de Admin: hasModule devuelve true para TODOS los módulos aunque los flags estén en false', () => {
    mockAuth = {
      claims: { userId: 1, username: 'admin', role: 'Admin' },
      isAuthenticated: true,
    }
    // Incluso con flags cacheados todos a false, un Admin pasa siempre (§5.3)
    const { result } = renderPermissions(ALL_FALSE)
    for (const module of ALL_MODULES) {
      expect(result.current.hasModule(module)).toBe(true)
    }
    expect(result.current.isAdmin).toBe(true)
    expect(result.current.isLoading).toBe(false)
  })

  it('usuario normal: hasModule mira el flag real de cada módulo', () => {
    mockAuth = {
      claims: { userId: 2, username: 'testuser', role: 'User' },
      isAuthenticated: true,
    }
    const { result } = renderPermissions({ ...ALL_FALSE, filesEnabled: true })
    expect(result.current.isAdmin).toBe(false)
    expect(result.current.hasModule('Files')).toBe(true)
    expect(result.current.hasModule('AuditLogs')).toBe(false)
  })
})

describe('resolveHasModule (lógica pura)', () => {
  it('sin permisos cargados y sin rol Admin, deniega', () => {
    expect(resolveHasModule(false, undefined, 'Files')).toBe(false)
  })

  it('admin pasa incluso sin permisos cargados', () => {
    expect(resolveHasModule(true, undefined, 'RemoteScripts')).toBe(true)
  })
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/shared/api/client'
import type { ApiObjResponse } from '@/shared/types/api'

import {
  auditLogsKeys,
  EMPTY_AUDIT_FILTERS,
  SUMMARY_WINDOW_HOURS,
  useAuditLogs,
  useAuditSummary,
  useUserSuggestions,
  USER_SUGGESTIONS_LIMIT,
  type AuditLogsFilters,
} from './api'

// Los tests cuentan llamadas a api.get: sin restaurar, el espía arrastra las de los tests anteriores
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function envelope<T>(data: T): ApiObjResponse<T> {
  return { result: true, data, errorCode: null, errorMessage: null }
}

const EMPTY_PAGE = { items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 }

describe('useAuditLogs — cache por combinación de filtros/página', () => {
  it('la query key es distinta para cada combinación de filtros y página', () => {
    const base = auditLogsKeys.list(EMPTY_AUDIT_FILTERS, 1)
    const combos: Array<[AuditLogsFilters, number]> = [
      [{ ...EMPTY_AUDIT_FILTERS, userName: 'ana' }, 1],
      [{ ...EMPTY_AUDIT_FILTERS, userId: 5 }, 1],
      [{ ...EMPTY_AUDIT_FILTERS, action: 'LOGIN' }, 1],
      [{ ...EMPTY_AUDIT_FILTERS, resourceType: 'FileItem' }, 1],
      [{ ...EMPTY_AUDIT_FILTERS, from: '2026-01-01' }, 1],
      [{ ...EMPTY_AUDIT_FILTERS, to: '2026-02-01' }, 1],
      [EMPTY_AUDIT_FILTERS, 2],
    ]
    const serialized = new Set(combos.map(([f, p]) => JSON.stringify(auditLogsKeys.list(f, p))))
    expect(serialized.size).toBe(combos.length)
    expect(serialized.has(JSON.stringify(base))).toBe(false)
  })

  it('dos combinaciones distintas crean DOS entradas de caché separadas', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: envelope(EMPTY_PAGE) })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { rerender } = renderHook(
      ({ filters, page }: { filters: AuditLogsFilters; page: number }) => useAuditLogs(filters, page),
      { wrapper, initialProps: { filters: EMPTY_AUDIT_FILTERS, page: 1 } },
    )
    rerender({ filters: { ...EMPTY_AUDIT_FILTERS, action: 'LOGIN' }, page: 1 })

    await waitFor(() => {
      expect(queryClient.getQueryCache().getAll()).toHaveLength(2)
    })
  })
})

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, wrapper }
}

describe('useAuditLogs — usuario exacto', () => {
  it('envía userId (exacto) además de userName (subcadena), y los omite si no hay', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: envelope(EMPTY_PAGE) })
    const { wrapper } = createWrapper()

    renderHook(() => useAuditLogs({ ...EMPTY_AUDIT_FILTERS, userId: 5, userName: 'an' }, 1), { wrapper })
    renderHook(() => useAuditLogs(EMPTY_AUDIT_FILTERS, 1), { wrapper })

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    const [withUser, withoutUser] = get.mock.calls.map((call) => (call[1] as { params: Record<string, unknown> }).params)
    expect(withUser).toMatchObject({ userId: 5, userName: 'an' })
    expect(withoutUser.userId).toBeUndefined()
    expect(withoutUser.userName).toBeUndefined()
  })
})

describe('useAuditSummary', () => {
  const pageWithTotal = (totalCount: number) => ({ ...EMPTY_PAGE, totalCount })

  it('pide 5 recuentos de UNA fila: todas, inicios de sesión y cada acción sensible', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: envelope(pageWithTotal(3)) })
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useAuditSummary(), { wrapper })

    await waitFor(() => expect(result.current.isPending).toBe(false))
    const calls = get.mock.calls.map((call) => (call[1] as { params: Record<string, unknown> }).params)
    expect(calls).toHaveLength(5)
    expect(calls.every((params) => params.pageSize === 1 && params.page === 1)).toBe(true)
    expect(calls.map((params) => params.action)).toEqual([
      undefined,
      'LOGIN',
      'REGISTER',
      'CHANGE_PASSWORD',
      'DELETE_USER',
    ])
  })

  it('la cifra es el totalCount, y la ventana de 24 h se calcula al ejecutar la consulta', async () => {
    const NOW = new Date('2026-11-02T18:00:00.000Z')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    const get = vi.spyOn(api, 'get').mockImplementation((_url, config) => {
      const action = (config?.params as { action?: string }).action
      return Promise.resolve({ data: envelope(pageWithTotal(action === 'LOGIN' ? 7 : 2)) })
    })
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useAuditSummary(), { wrapper })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    vi.useRealTimers()

    expect(result.current.total).toBe(2)
    expect(result.current.logins).toBe(7)
    expect(result.current.sensitive).toEqual([
      { action: 'REGISTER', count: 2 },
      { action: 'CHANGE_PASSWORD', count: 2 },
      { action: 'DELETE_USER', count: 2 },
    ])
    const from = (get.mock.calls[0][1] as { params: { from: string } }).params.from
    expect(from).toBe(new Date(NOW.getTime() - SUMMARY_WINDOW_HOURS * 3_600_000).toISOString())
    expect(from.endsWith('Z')).toBe(true)
  })

  it('la clave de caché no incluye el instante: es estable', () => {
    expect(JSON.stringify(auditLogsKeys.count('LOGIN', 24))).toBe(JSON.stringify(auditLogsKeys.count('LOGIN', 24)))
  })

  it('si un recuento falla, solo ese queda sin dato', async () => {
    vi.spyOn(api, 'get').mockImplementation((_url, config) => {
      if ((config?.params as { action?: string }).action === 'DELETE_USER') return Promise.reject(new Error('x'))
      return Promise.resolve({ data: envelope(pageWithTotal(1)) })
    })
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useAuditSummary(), { wrapper })

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.total).toBe(1)
    expect(result.current.sensitive.find((item) => item.action === 'DELETE_USER')?.count).toBeUndefined()
  })
})

describe('useUserSuggestions', () => {
  const users = [{ id: 5, username: 'ana', email: 'a@x.com', createdAt: '2026-01-01T00:00:00Z', roles: ['User'] }]

  it('busca usuarios por nombre con un tope de resultados y se queda con id y nombre', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: envelope({ users, totalCount: 1, page: 1, pageSize: 6, totalPages: 1 }) })
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useUserSuggestions(' an ', true), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(get).toHaveBeenCalledWith('/admin/users', {
      params: { userName: 'an', page: 1, pageSize: USER_SUGGESTIONS_LIMIT },
    })
    expect(result.current.data).toEqual([{ id: 5, username: 'ana' }])
  })

  it('sin el módulo UserManagement (enabled=false) no dispara ninguna petición (evita el 403)', () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: envelope({ users, totalCount: 1, page: 1, pageSize: 6, totalPages: 1 }) })
    const { wrapper } = createWrapper()

    renderHook(() => useUserSuggestions('an', false), { wrapper })

    expect(get).not.toHaveBeenCalled()
  })

  it('con el término vacío tampoco consulta', () => {
    const get = vi.spyOn(api, 'get')
    const { wrapper } = createWrapper()

    renderHook(() => useUserSuggestions('   ', true), { wrapper })

    expect(get).not.toHaveBeenCalled()
  })
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/shared/api/client'
import type { ApiObjResponse } from '@/shared/types/api'

import { EMPTY_FILTERS, usersKeys, useUsers, type UsersFilters } from './api'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

function envelope<T>(data: T): ApiObjResponse<T> {
  return { result: true, data, errorCode: null, errorMessage: null }
}

const EMPTY_PAGE = { users: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 }

describe('useUsers — cache por combinación de filtros/página', () => {
  it('la query key es distinta para cada combinación de filtros y página', () => {
    const base = usersKeys.list(EMPTY_FILTERS, 1)
    const combos: Array<[UsersFilters, number]> = [
      [{ ...EMPTY_FILTERS, search: 'ana' }, 1],
      [{ ...EMPTY_FILTERS, search: 'ana@x.com' }, 1],
      [{ ...EMPTY_FILTERS, role: 'Admin' }, 1],
      [{ ...EMPTY_FILTERS, from: '2026-01-01' }, 1],
      [{ ...EMPTY_FILTERS, to: '2026-02-01' }, 1],
      [EMPTY_FILTERS, 2],
    ]
    const serialized = new Set(combos.map(([f, p]) => JSON.stringify(usersKeys.list(f, p))))
    // Todas distintas entre sí y distintas de la base
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
      ({ filters, page }: { filters: UsersFilters; page: number }) => useUsers(filters, page),
      { wrapper, initialProps: { filters: EMPTY_FILTERS, page: 1 } },
    )
    rerender({ filters: { ...EMPTY_FILTERS, search: 'ana' }, page: 1 })

    await waitFor(() => {
      expect(queryClient.getQueryCache().getAll()).toHaveLength(2)
    })
  })
})

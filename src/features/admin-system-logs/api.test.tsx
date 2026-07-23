import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/shared/api/client'
import type { ApiObjResponse } from '@/shared/types/api'

import { EMPTY_LOGS_FILTERS, logsKeys, useLogs, type LogsFilters } from './api'

function envelope<T>(data: T): ApiObjResponse<T> {
  return { result: true, data, errorCode: null, errorMessage: null }
}

const EMPTY_PAGE = { items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 }

describe('useLogs — cache por combinación de filtros/página', () => {
  it('la query key es distinta para cada combinación de filtros y página', () => {
    const base = logsKeys.list(EMPTY_LOGS_FILTERS, 1)
    const combos: Array<[LogsFilters, number]> = [
      [{ ...EMPTY_LOGS_FILTERS, level: 'Warning' }, 1],
      [{ ...EMPTY_LOGS_FILTERS, operation: 'GetFiles' }, 1],
      [{ ...EMPTY_LOGS_FILTERS, from: '2026-01-01' }, 1],
      [{ ...EMPTY_LOGS_FILTERS, to: '2026-02-01' }, 1],
      [{ ...EMPTY_LOGS_FILTERS, correlationId: 'abc-123' }, 1],
      [EMPTY_LOGS_FILTERS, 2],
    ]
    const serialized = new Set(combos.map(([f, p]) => JSON.stringify(logsKeys.list(f, p))))
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
      ({ filters, page }: { filters: LogsFilters; page: number }) => useLogs(filters, page),
      { wrapper, initialProps: { filters: EMPTY_LOGS_FILTERS, page: 1 } },
    )
    rerender({ filters: { ...EMPTY_LOGS_FILTERS, level: 'Critical' }, page: 1 })

    await waitFor(() => {
      expect(queryClient.getQueryCache().getAll()).toHaveLength(2)
    })
  })
})

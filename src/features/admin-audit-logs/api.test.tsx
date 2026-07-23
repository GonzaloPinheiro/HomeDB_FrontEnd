import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/shared/api/client'
import type { ApiObjResponse } from '@/shared/types/api'

import { auditLogsKeys, EMPTY_AUDIT_FILTERS, useAuditLogs, type AuditLogsFilters } from './api'

function envelope<T>(data: T): ApiObjResponse<T> {
  return { result: true, data, errorCode: null, errorMessage: null }
}

const EMPTY_PAGE = { items: [], totalCount: 0, page: 1, pageSize: 20, totalPages: 0 }

describe('useAuditLogs — cache por combinación de filtros/página', () => {
  it('la query key es distinta para cada combinación de filtros y página', () => {
    const base = auditLogsKeys.list(EMPTY_AUDIT_FILTERS, 1)
    const combos: Array<[AuditLogsFilters, number]> = [
      [{ ...EMPTY_AUDIT_FILTERS, userName: 'ana' }, 1],
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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/shared/api/client'
import type { ApiObjResponse } from '@/shared/types/api'

import {
  EMPTY_LOGS_FILTERS,
  logsKeys,
  useErrorSummary,
  useLogs,
  useSlowOperations,
  type LogsFilters,
} from './api'

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

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, wrapper }
}

describe('useErrorSummary', () => {
  it('pide /admin/logs/error-summary con las horas y valida la respuesta', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValue({ data: envelope([{ operation: 'UploadChunkAsync()', count: 4 }]) })
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useErrorSummary(168), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(get).toHaveBeenCalledWith('/admin/logs/error-summary', { params: { hours: 168 } })
    expect(result.current.data).toEqual([{ operation: 'UploadChunkAsync()', count: 4 }])
  })

  it('una respuesta con otra forma falla en Zod en vez de pintar datos rotos', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: envelope([{ operation: 'X', total: 4 }]) })
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useErrorSummary(24), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('cada rango cachea por separado', () => {
    expect(logsKeys.errorSummary(24)).not.toEqual(logsKeys.errorSummary(168))
  })
})

describe('useSlowOperations', () => {
  it('pide /admin/logs/slow-operations con el umbral y valida la respuesta', async () => {
    const slow = { operation: 'GetFilesAsync()', durationMs: 4100, timeStamp: '2026-10-30T18:02:11Z' }
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: envelope([slow]) })
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useSlowOperations(5000), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(get).toHaveBeenCalledWith('/admin/logs/slow-operations', { params: { thresholdMs: 5000 } })
    expect(result.current.data).toEqual([slow])
  })

  it('el campo del timestamp es `timeStamp` (S mayúscula), no `timestamp`', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: envelope([{ operation: 'X', durationMs: 3000, timestamp: '2026-10-30T18:02:11Z' }]),
    })
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useSlowOperations(2000), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('cada umbral cachea por separado', () => {
    expect(logsKeys.slowOperations(2000)).not.toEqual(logsKeys.slowOperations(5000))
  })
})

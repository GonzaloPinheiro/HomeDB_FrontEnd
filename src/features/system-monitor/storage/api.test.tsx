import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, api } from '@/shared/api/client'
import type { ApiObjResponse } from '@/shared/types/api'

import { storageKeys, useStorageLocations } from './api'

const WIRE_ROW = {
  locationKey: 'media',
  diskKey: 'hdd1',
  usage: 2,
  isDefault: true,
  isAvailable: true,
  isWritable: true,
  reason: null,
  checkedAtUtc: '2026-11-21T10:00:00Z',
  totalBytes: 4_000_000_000_000,
  usedBytes: 1_000_000_000_000,
  freeBytes: 3_000_000_000_000,
  minFreeBytes: 0,
  maxUsedBytes: null,
}

function envelope<T>(data: T): ApiObjResponse<T> {
  return { result: true, data, errorCode: null, errorMessage: null }
}

function renderStorage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => useStorageLocations(), { wrapper })
}

describe('useStorageLocations', () => {
  afterEach(() => vi.restoreAllMocks())

  it('pide GET /storage/locations y valida y normaliza la respuesta', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: envelope([WIRE_ROW]) })
    const { result } = renderStorage()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(get).toHaveBeenCalledWith('/storage/locations')
    expect(result.current.data?.[0]).toMatchObject({ diskKey: 'hdd1', usage: 'media' })
  })

  it('una respuesta que no cumple el contrato es un error, no datos a medias', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: envelope([{ ...WIRE_ROW, usage: 9 }]) })
    const { result } = renderStorage()
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })

  it('un envelope de error (p. ej. 1003 sin el módulo) llega como ApiError', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { result: false, data: null, errorCode: 1003, errorMessage: 'Forbidden' },
    })
    const { result } = renderStorage()
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(ApiError)
    expect((result.current.error as ApiError).errorCode).toBe(1003)
  })

  it('su clave de caché cuelga de la rama del Monitor, para que Refrescar la invalide', () => {
    expect(storageKeys.locations.slice(0, storageKeys.all.length)).toEqual([...storageKeys.all])
  })
})

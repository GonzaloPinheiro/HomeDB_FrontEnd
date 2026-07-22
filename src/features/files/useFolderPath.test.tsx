import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { api } from '@/shared/api/client'
import type { ApiObjResponse } from '@/shared/types/api'

import { resolveFolderPath, useFolderPath } from './useFolderPath'

function envelope<T>(data: T): ApiObjResponse<T> {
  return { result: true, data, errorCode: null, errorMessage: null }
}

// Forma real de GetFolderResponseDto (verificada en FoldersDTOs.cs / FoldersService,
// fase de integración): id, name, parentFolderId, ownerId, createdAt.
type FakeFolder = { id: number; name: string; parentFolderId: number | null; ownerId: number; createdAt: string }

const FOLDERS: Record<number, FakeFolder> = {
  1: { id: 1, name: 'Documentos', parentFolderId: null, ownerId: 1, createdAt: '2026-01-01T00:00:00Z' },
  2: { id: 2, name: 'Facturas', parentFolderId: 1, ownerId: 1, createdAt: '2026-01-01T00:00:00Z' },
  3: { id: 3, name: '2026', parentFolderId: 2, ownerId: 1, createdAt: '2026-01-01T00:00:00Z' },
}

function mockGetById() {
  return vi.spyOn(api, 'get').mockImplementation(async (url: unknown) => {
    const id = Number(String(url).split('/').pop())
    return { data: envelope(FOLDERS[id]) }
  })
}

describe('resolveFolderPath (CLAUDE.md §5.5: breadcrumb con nombres reales en deep link/F5)', () => {
  it('sube por parentFolderId hasta la raíz, una petición GET /folders/{id} por nivel', async () => {
    const getSpy = mockGetById()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    const path = await resolveFolderPath(queryClient, 3)

    expect(path).toEqual([
      { id: null, name: 'Inicio' },
      { id: 1, name: 'Documentos' },
      { id: 2, name: 'Facturas' },
      { id: 3, name: '2026' },
    ])
    expect(getSpy).toHaveBeenCalledTimes(3)
    expect(getSpy).toHaveBeenCalledWith('/folders/1')
    expect(getSpy).toHaveBeenCalledWith('/folders/2')
    expect(getSpy).toHaveBeenCalledWith('/folders/3')
  })

  it('una carpeta ya en la raíz (parentFolderId null) resuelve con una sola llamada', async () => {
    mockGetById()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    const path = await resolveFolderPath(queryClient, 1)

    expect(path).toEqual([
      { id: null, name: 'Inicio' },
      { id: 1, name: 'Documentos' },
    ])
  })

  it('reutiliza la caché del QueryClient: dos rutas que comparten antecesores no repiten peticiones (§6.3)', async () => {
    const getSpy = mockGetById()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    await resolveFolderPath(queryClient, 3) // pide 1, 2 y 3
    getSpy.mockClear()
    await resolveFolderPath(queryClient, 2) // 1 y 2 ya están cacheados

    expect(getSpy).not.toHaveBeenCalled()
  })
})

describe('useFolderPath', () => {
  function wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  it('enabled=false (carpeta ya conocida por el trail de navegación normal): no dispara ninguna petición', () => {
    const getSpy = vi.spyOn(api, 'get')
    const { result } = renderHook(() => useFolderPath(3, false), { wrapper })

    expect(getSpy).not.toHaveBeenCalled()
    expect(result.current.data).toBeUndefined()
  })

  it('folderId null: no dispara ninguna petición aunque enabled sea true (la raíz no necesita resolverse)', () => {
    const getSpy = vi.spyOn(api, 'get')
    renderHook(() => useFolderPath(null, true), { wrapper })

    expect(getSpy).not.toHaveBeenCalled()
  })

  it('enabled=true y carpeta desconocida: resuelve la ruta real en vez del marcador genérico', async () => {
    mockGetById()
    const { result } = renderHook(() => useFolderPath(3, true), { wrapper })

    await waitFor(() =>
      expect(result.current.data).toEqual([
        { id: null, name: 'Inicio' },
        { id: 1, name: 'Documentos' },
        { id: 2, name: 'Facturas' },
        { id: 3, name: '2026' },
      ]),
    )
  })
})

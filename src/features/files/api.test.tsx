import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/shared/api/client'
import type { ApiObjResponse } from '@/shared/types/api'

import { FILE_MOVE_ENABLED, useMoveFile, useRenameFile } from './api'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

function envelope<T>(data: T): ApiObjResponse<T> {
  return { result: true, data, errorCode: null, errorMessage: null }
}

const FILE_DTO = {
  id: 1,
  fileName: 'archivo.txt',
  sizeBytes: 100,
  contentType: 'text/plain',
  folderId: 5,
  uploadedAt: '2026-01-01T00:00:00Z',
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

// CLAUDE.md §7.5: FilesController.UpdateFileAsync (PATCH /files/{id}) quedó
// confirmado en la fase de integración -> FILE_MOVE_ENABLED pasó a true. Este
// test centinela sustituye al que la Fase 2b dejó fallando a propósito
// (antes comprobaba que el flag seguía en false).
describe('useMoveFile / useRenameFile con FILE_MOVE_ENABLED=true (CLAUDE.md §7.5)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('el interruptor está activo — si esto falla, vuelve a false hasta reverificar el endpoint contra el backend real', () => {
    expect(FILE_MOVE_ENABLED).toBe(true)
  })

  it('mover: llama a PATCH /files/{id} con newFolderId (verificado en FilesService.UpdateFileAsync, no folderId como asumía CLAUDE.md antes) e invalida origen y destino', async () => {
    const patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: envelope(FILE_DTO) })
    const { result } = renderHook(() => useMoveFile(3), { wrapper })

    await result.current.mutateAsync({ fileId: 1, targetFolderId: 5 })

    expect(patchSpy).toHaveBeenCalledWith('/files/1', { newFolderId: 5 })
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Archivo movido'))
  })

  it('mover a la raíz: newFolderId se envía como null explícito (nunca se omite el campo)', async () => {
    vi.spyOn(api, 'patch').mockResolvedValue({ data: envelope(FILE_DTO) })
    const { result } = renderHook(() => useMoveFile(3), { wrapper })

    await result.current.mutateAsync({ fileId: 1, targetFolderId: null })

    expect(api.patch).toHaveBeenCalledWith('/files/1', { newFolderId: null })
  })

  it('renombrar: SIEMPRE incluye newFolderId (la carpeta actual) junto con newFileName — UpdateFileAsync asigna fileItem.FolderId = dto.NewFolderId sin comprobar si vino en el body, así que omitirlo movería el archivo a la raíz como efecto secundario de renombrarlo', async () => {
    const patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: envelope(FILE_DTO) })
    const { result } = renderHook(() => useRenameFile(5), { wrapper })

    await result.current.mutateAsync({ fileId: 1, newName: 'nuevo.txt' })

    expect(patchSpy).toHaveBeenCalledWith('/files/1', { newFileName: 'nuevo.txt', newFolderId: 5 })
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Archivo renombrado'))
  })

  it('renombrar en la raíz (folderId null): newFolderId sigue yendo explícito, no se omite', async () => {
    vi.spyOn(api, 'patch').mockResolvedValue({ data: envelope({ ...FILE_DTO, folderId: null }) })
    const { result } = renderHook(() => useRenameFile(null), { wrapper })

    await result.current.mutateAsync({ fileId: 1, newName: 'nuevo.txt' })

    expect(api.patch).toHaveBeenCalledWith('/files/1', { newFileName: 'nuevo.txt', newFolderId: null })
  })
})

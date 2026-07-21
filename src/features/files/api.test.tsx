import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/shared/api/client'

import { FILE_MOVE_ENABLED, useMoveFile, useRenameFile } from './api'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useMoveFile / useRenameFile con FILE_MOVE_ENABLED=false (CLAUDE.md §7.5)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('el interruptor sigue apagado — si esto falla, el endpoint ya existe: actualiza estos tests al caso real', () => {
    expect(FILE_MOVE_ENABLED).toBe(false)
  })

  it('mover: no llama a la API, no lanza error, muestra el toast informativo', async () => {
    const patchSpy = vi.spyOn(api, 'patch')
    const { result } = renderHook(() => useMoveFile(null), { wrapper })

    await result.current.mutateAsync({ fileId: 1, targetFolderId: 5 })

    expect(patchSpy).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith('Mover archivos aún no está disponible')
    })
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('renombrar archivo: no llama a la API, no lanza error, muestra el toast informativo', async () => {
    const patchSpy = vi.spyOn(api, 'patch')
    const { result } = renderHook(() => useRenameFile(null), { wrapper })

    await result.current.mutateAsync({ fileId: 1, newName: 'nuevo.txt' })

    expect(patchSpy).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith('Renombrar archivos aún no está disponible')
    })
    expect(toast.error).not.toHaveBeenCalled()
  })
})

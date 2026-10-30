import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/shared/api/client'
import { ApiErrorCodes } from '@/shared/api/errors'

import type { UploadStatusResponse } from '../types'
import { UploadSessionEndedError } from './completion'
import { RateLimitGate } from './rateLimit'
import {
  ResumableStore,
  resumableStorageKey,
  type ResumableQuery,
  type ResumableUpload,
  type StorageLike,
} from './resumableUploads'
import { useInterruptedUploads } from './useInterruptedUploads'

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast: toasts }))

const getUploadStatus = vi.hoisted(() => vi.fn())
vi.mock('./pipeline', () => ({ getUploadStatus }))

const waitForUploadCompletion = vi.hoisted(() => vi.fn())
vi.mock('./completion', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  waitForUploadCompletion,
}))

const NOW = 1_800_000_000_000

function record(overrides: Partial<ResumableUpload> = {}): ResumableUpload {
  return {
    sessionId: 's1',
    fileName: 'peli.mp4',
    size: 100,
    lastModified: 1234,
    chunkSizeBytes: 32,
    totalChunks: 4,
    folderId: 7,
    folderName: 'Archivos/Pelis',
    phase: 'uploading',
    createdAt: NOW,
    ...overrides,
  }
}

function status(overrides: Partial<UploadStatusResponse> = {}): UploadStatusResponse {
  return {
    sessionId: 's1',
    totalChunks: 4,
    receivedChunks: [1, 2],
    status: 'inProgress',
    file: null,
    errorCode: null,
    ...overrides,
  }
}

function memoryStorage(): StorageLike {
  const data: Record<string, string> = {}
  return { getItem: (key) => data[key] ?? null, setItem: (key, value) => void (data[key] = value) }
}

function setup(records: ResumableUpload[]) {
  const store = new ResumableStore(memoryStorage(), resumableStorageKey(1), () => NOW + 1000)
  for (const item of records) store.upsert(item)
  const gate = new RateLimitGate()
  const queryClient = new QueryClient()
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const hook = renderHook(() => useInterruptedUploads(store, gate), { wrapper })
  return { ...hook, store, invalidate }
}

const query: ResumableQuery = {
  fileName: 'peli.mp4',
  size: 100,
  lastModified: 1234,
  chunkSizeBytes: 32,
  totalChunks: 4,
  folderId: 7,
}

beforeEach(() => {
  getUploadStatus.mockReset()
  waitForUploadCompletion.mockReset()
  toasts.success.mockClear()
  toasts.error.mockClear()
})
afterEach(cleanup)

describe('useInterruptedUploads — comprobación al cargar', () => {
  it('una sesión que sigue a medias aparece como interrumpida, con lo que ya tiene el servidor', async () => {
    getUploadStatus.mockResolvedValue(status({ receivedChunks: [1, 2, 3] }))
    const { result, store } = setup([record()])

    await waitFor(() => expect(result.current.interrupted).toHaveLength(1))

    expect(result.current.interrupted[0]).toMatchObject({
      sessionId: 's1',
      fileName: 'peli.mp4',
      receivedChunks: 3,
    })
    expect(store.list()).toHaveLength(1) // sigue guardada: aún se puede reanudar
  })

  it('una sesión que terminó mientras no estabas se limpia, se refresca la carpeta y se avisa', async () => {
    getUploadStatus.mockResolvedValue(status({ status: 'completed' }))
    const { result, store, invalidate } = setup([record()])

    await waitFor(() => expect(store.list()).toHaveLength(0))

    expect(result.current.interrupted).toEqual([])
    expect(toasts.success).toHaveBeenCalledWith('"peli.mp4" ya está subido')
    const keys = invalidate.mock.calls.map(([filters]) =>
      JSON.stringify((filters as { queryKey: unknown }).queryKey),
    )
    expect(keys).toContain(JSON.stringify(['files', 'contents', 7]))
  })

  it('una sesión cancelada por el servidor se limpia y se explica el motivo', async () => {
    getUploadStatus.mockResolvedValue(
      status({ status: 'cancelled', errorCode: ApiErrorCodes.InvalidFileExtension }),
    )
    const { result, store } = setup([record()])

    await waitFor(() => expect(store.list()).toHaveLength(0))

    expect(result.current.interrupted).toEqual([])
    expect(toasts.error).toHaveBeenCalledTimes(1)
    expect(toasts.error.mock.calls[0][0]).toContain('peli.mp4')
  })

  it('una sesión que ya no existe en el servidor se limpia en silencio', async () => {
    getUploadStatus.mockRejectedValue(
      new ApiError(ApiErrorCodes.UploadSessionNotFound, 'no existe', { httpStatus: 404 }),
    )
    const { result, store } = setup([record()])

    await waitFor(() => expect(store.list()).toHaveLength(0))

    expect(result.current.interrupted).toEqual([])
    expect(toasts.error).not.toHaveBeenCalled()
  })

  it('sin red NO borra nada: el registro se conserva para la próxima carga', async () => {
    getUploadStatus.mockRejectedValue(new ApiError(null, 'sin conexión'))
    const { result, store } = setup([record()])

    await waitFor(() => expect(getUploadStatus).toHaveBeenCalled())
    await act(async () => {})

    expect(store.list()).toHaveLength(1)
    expect(result.current.interrupted).toEqual([])
    expect(toasts.error).not.toHaveBeenCalled()
  })

  it('un 500 del servidor tampoco borra nada', async () => {
    getUploadStatus.mockRejectedValue(
      new ApiError(ApiErrorCodes.InternalError, 'fallo', { httpStatus: 500 }),
    )
    const { store } = setup([record()])
    await waitFor(() => expect(getUploadStatus).toHaveBeenCalled())
    await act(async () => {})
    expect(store.list()).toHaveLength(1)
  })

  it('comprueba cada sesión guardada', async () => {
    getUploadStatus.mockImplementation(async (sessionId: string) => status({ sessionId }))
    const { result } = setup([
      record({ sessionId: 'a', fileName: 'a.mp4' }),
      record({ sessionId: 'b', fileName: 'b.mp4' }),
    ])

    await waitFor(() => expect(result.current.interrupted).toHaveLength(2))
    expect(result.current.interrupted.map((i) => i.sessionId).sort()).toEqual(['a', 'b'])
  })

  it('sin almacenamiento (null) no hace nada', async () => {
    const queryClient = new QueryClient()
    const { result } = renderHook(() => useInterruptedUploads(null, new RateLimitGate()), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    })
    await act(async () => {})
    expect(getUploadStatus).not.toHaveBeenCalled()
    expect(result.current.interrupted).toEqual([])
    expect(result.current.claim(query)).toBeUndefined()
  })
})

describe('useInterruptedUploads — sesiones que el servidor está ensamblando', () => {
  it('espera el final en segundo plano SIN necesitar el archivo, y avisa al terminar', async () => {
    getUploadStatus.mockResolvedValue(status({ status: 'processing' }))
    waitForUploadCompletion.mockResolvedValue(status({ status: 'completed' }))
    const { result, store, invalidate } = setup([record({ phase: 'processing' })])

    await waitFor(() => expect(store.list()).toHaveLength(0))

    expect(result.current.interrupted).toEqual([]) // no es una "interrumpida": no hay nada que reanudar
    expect(toasts.success).toHaveBeenCalledWith('"peli.mp4" ya está subido')
    expect(invalidate).toHaveBeenCalled()
  })

  it('si el ensamblado acaba mal, limpia y explica por qué', async () => {
    getUploadStatus.mockResolvedValue(status({ status: 'processing' }))
    waitForUploadCompletion.mockRejectedValue(
      new UploadSessionEndedError(ApiErrorCodes.AssembledFileSizeMismatch),
    )
    const { store } = setup([record({ phase: 'processing' })])

    await waitFor(() => expect(store.list()).toHaveLength(0))
    expect(toasts.error).toHaveBeenCalledTimes(1)
  })

  it('si falla la red mientras espera, conserva el registro', async () => {
    getUploadStatus.mockResolvedValue(status({ status: 'processing' }))
    waitForUploadCompletion.mockRejectedValue(new ApiError(null, 'sin conexión'))
    const { store } = setup([record({ phase: 'processing' })])

    await waitFor(() => expect(waitForUploadCompletion).toHaveBeenCalled())
    await act(async () => {})
    expect(store.list()).toHaveLength(1)
    expect(toasts.error).not.toHaveBeenCalled()
  })
})

describe('useInterruptedUploads — reclamar y descartar', () => {
  it('claim entrega el registro que coincide, una sola vez, y lo quita de las interrumpidas', async () => {
    getUploadStatus.mockResolvedValue(status())
    const { result } = setup([record()])
    await waitFor(() => expect(result.current.interrupted).toHaveLength(1))

    let claimed: ResumableUpload | undefined
    act(() => {
      claimed = result.current.claim(query)
    })
    expect(claimed?.sessionId).toBe('s1')
    expect(result.current.interrupted).toEqual([])

    let again: ResumableUpload | undefined
    act(() => {
      again = result.current.claim(query)
    })
    expect(again).toBeUndefined() // dos copias del mismo archivo no comparten sesión
  })

  it('claim no entrega un registro de otro archivo o carpeta', async () => {
    getUploadStatus.mockResolvedValue(status())
    const { result } = setup([record()])
    await waitFor(() => expect(result.current.interrupted).toHaveLength(1))

    expect(result.current.claim({ ...query, fileName: 'otra.mp4' })).toBeUndefined()
    expect(result.current.claim({ ...query, folderId: null })).toBeUndefined()
    expect(result.current.interrupted).toHaveLength(1)
  })

  it('un registro reclamado ANTES de que acabe la comprobación no reaparece como interrumpido', async () => {
    let answer!: (value: UploadStatusResponse) => void
    getUploadStatus.mockReturnValue(
      new Promise<UploadStatusResponse>((resolve) => (answer = resolve)),
    )
    const { result } = setup([record()])
    await waitFor(() => expect(getUploadStatus).toHaveBeenCalled())

    act(() => {
      result.current.claim(query)
    })
    await act(async () => answer(status()))

    expect(result.current.interrupted).toEqual([])
  })

  it('discard olvida la subida: sale de la lista y del almacenamiento', async () => {
    getUploadStatus.mockResolvedValue(status())
    const { result, store } = setup([record()])
    await waitFor(() => expect(result.current.interrupted).toHaveLength(1))

    act(() => result.current.discard('s1'))

    expect(result.current.interrupted).toEqual([])
    expect(store.list()).toEqual([])
  })
})

describe('useInterruptedUploads — desmontar', () => {
  it('al desmontar a mitad de la comprobación, no actualiza estado ni toca el almacenamiento', async () => {
    let answer!: (value: UploadStatusResponse) => void
    getUploadStatus.mockReturnValue(
      new Promise<UploadStatusResponse>((resolve) => (answer = resolve)),
    )
    const { unmount, store } = setup([record()])
    await waitFor(() => expect(getUploadStatus).toHaveBeenCalled())

    unmount()
    await act(async () => answer(status({ status: 'completed' })))

    expect(store.list()).toHaveLength(1) // la respuesta llegó tarde: se ignora
    expect(toasts.success).not.toHaveBeenCalled()
  })
})

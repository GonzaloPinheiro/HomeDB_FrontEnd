import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/shared/api/client'
import { ApiErrorCodes } from '@/shared/api/errors'

import { filesKeys } from '../api'
import type { UploadFileResponse, UploadStatusResponse } from '../types'
import { DIRECT_UPLOAD_MAX_BYTES, UNCERTAIN_OUTCOME_MESSAGE } from './directUpload'
import * as pipeline from './pipeline'
import type { UploadTarget } from './types'
import { UploadQueueProvider, useUploadQueueActions, useUploadQueueState } from './UploadQueueContext'

// CLAUDE.md §9: el Provider no es visual, así que se prueba lo que no debe romperse sin
// que lo note el typecheck: que las acciones sigan siendo estables (la razón de tener
// dos Contexts, §7.4), que cada archivo siga el camino que le toca (directo o por
// sesión), que un fallo de la subida directa no se reintente a ciegas (duplicaría el
// archivo) y que las invalidaciones de caché se agrupen. La red se simula sustituyendo
// las llamadas HTTP de pipeline.ts; el resto (planificador, semáforos, pausa por rate
// limit, espera del ensamblado) es el real.
vi.mock('./pipeline', async (importOriginal) => {
  const original = await importOriginal<typeof import('./pipeline')>()
  return {
    ...original,
    uploadFileDirect: vi.fn(),
    initUploadSession: vi.fn(),
    uploadChunkWithRetry: vi.fn(),
    completeUploadSession: vi.fn(),
    getUploadStatus: vi.fn(),
  }
})

const mocked = vi.mocked(pipeline)

const COMPLETED: UploadStatusResponse = {
  sessionId: 'sesion',
  totalChunks: 1,
  receivedChunks: [1],
  status: 'completed',
  file: null,
  errorCode: null,
}

const CREATED_FILE: UploadFileResponse = {
  id: 1,
  fileName: 'archivo.txt',
  sizeBytes: 9,
  contentType: 'text/plain',
  folderId: null,
  ownerId: 1,
  uploadedAt: '2026-11-09T10:00:00Z',
}

/** Una petición que nunca responde, pero que se aborta como lo haría axios al cancelar. */
function pendingUntilAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  })
}

const TARGET: UploadTarget = { folderId: null, folderName: 'Archivos' }

/** Archivos pequeños: van por la subida directa. */
function createFiles(count: number): File[] {
  return Array.from({ length: count }, (_, i) => new File(['contenido'], `archivo-${i}.txt`))
}

/**
 * Un archivo de `sizeBytes` sin reservar esa memoria: se le sobreescribe `size`. Basta porque
 * lo único que mira el Provider para elegir camino es su tamaño; los datos nunca se leen
 * (las peticiones están simuladas).
 */
function createFileOfSize(name: string, sizeBytes: number): File {
  const file = new File(['x'], name)
  Object.defineProperty(file, 'size', { value: sizeBytes })
  return file
}

const largeFile = (name: string) => createFileOfSize(name, DIRECT_UPLOAD_MAX_BYTES + 1)

let queryClient: QueryClient

function renderQueue() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <UploadQueueProvider>{children}</UploadQueueProvider>
    </QueryClientProvider>
  )
  return renderHook(() => ({ state: useUploadQueueState(), actions: useUploadQueueActions() }), { wrapper })
}

const statuses = (result: ReturnType<typeof renderQueue>['result']) => result.current.state.entries.map((e) => e.status)

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  mocked.uploadFileDirect.mockReset()
  mocked.initUploadSession.mockReset()
  mocked.uploadChunkWithRetry.mockReset()
  mocked.completeUploadSession.mockReset()
  mocked.getUploadStatus.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('UploadQueueProvider — acciones estables', () => {
  beforeEach(() => {
    mocked.uploadFileDirect.mockImplementation((_params, signal) => pendingUntilAborted(signal))
  })

  it('las acciones conservan su identidad mientras el estado cambia', async () => {
    const { result } = renderQueue()
    const initialActions = result.current.actions
    const initialState = result.current.state

    act(() => result.current.actions.openPanel(TARGET))
    act(() => {
      result.current.actions.addFiles(createFiles(2))
    })
    await waitFor(() => expect(statuses(result)).toEqual(['uploading', 'uploading']))

    expect(result.current.state).not.toBe(initialState)
    expect(result.current.actions).toBe(initialActions)
  })

  it('addFiles sin destino explícito usa el que fijó openPanel (y nada antes de fijarlo)', () => {
    const { result } = renderQueue()
    const { addFiles, openPanel } = result.current.actions

    expect(addFiles(createFiles(1))).toBe(0)

    act(() => openPanel(TARGET))
    let queued = 0
    act(() => {
      queued = addFiles(createFiles(3)) // la MISMA función de antes de abrir: lee el destino actual
    })
    expect(queued).toBe(3)
    expect(result.current.state.entries).toHaveLength(3)
  })

  it('cancelEntry cancela una entrada en cola y una que ya está subiendo', async () => {
    const { result } = renderQueue()
    act(() => result.current.actions.openPanel(TARGET))
    act(() => {
      result.current.actions.addFiles(createFiles(pipeline.MAX_CONCURRENT_DIRECT_UPLOADS + 1)) // la última espera hueco
    })
    await waitFor(() => expect(statuses(result).filter((s) => s === 'uploading')).toHaveLength(pipeline.MAX_CONCURRENT_DIRECT_UPLOADS))

    const entries = result.current.state.entries
    const uploading = entries[0]
    const queued = entries[entries.length - 1]
    expect(queued.status).toBe('queued')

    act(() => result.current.actions.cancelEntry(queued.id))
    act(() => result.current.actions.cancelEntry(uploading.id))

    await waitFor(() => expect(result.current.state.entries[0].status).toBe('cancelled'))
    expect(result.current.state.entries[entries.length - 1].status).toBe('cancelled')
  })

  it('retryAllFailed (capturada antes del fallo) ve las entradas que fallaron después', async () => {
    mocked.uploadFileDirect
      .mockReset()
      .mockRejectedValueOnce(new ApiError(ApiErrorCodes.FileTooLarge, 'demasiado grande', { httpStatus: 413 }))
      .mockImplementation((_params, signal) => pendingUntilAborted(signal))

    const { result } = renderQueue()
    const { retryAllFailed, openPanel, addFiles } = result.current.actions

    act(() => openPanel(TARGET))
    act(() => {
      addFiles(createFiles(1))
    })
    await waitFor(() => expect(result.current.state.entries[0]?.status).toBe('error'))

    act(() => retryAllFailed()) // no se vuelve a leer result.current.actions: es la función antigua
    await waitFor(() => expect(result.current.state.entries[0].status).toBe('uploading'))
    expect(mocked.uploadFileDirect).toHaveBeenCalledTimes(2)
  })
})

describe('UploadQueueProvider — subida directa (archivos de un solo chunk)', () => {
  beforeEach(() => {
    mocked.uploadFileDirect.mockResolvedValue(CREATED_FILE)
    mocked.initUploadSession.mockResolvedValue('sesion')
    mocked.uploadChunkWithRetry.mockResolvedValue(undefined)
    mocked.completeUploadSession.mockResolvedValue(undefined)
    mocked.getUploadStatus.mockResolvedValue(COMPLETED)
  })

  async function uploadOne(file: File, target = TARGET) {
    const queue = renderQueue()
    act(() => queue.result.current.actions.openPanel(target))
    act(() => {
      queue.result.current.actions.addFiles([file])
    })
    return queue
  }

  it('un archivo pequeño se sube con UNA petición: sin init, chunks, complete ni consulta de estado', async () => {
    const { result } = await uploadOne(createFiles(1)[0])
    await waitFor(() => expect(statuses(result)).toEqual(['done']))

    expect(mocked.uploadFileDirect).toHaveBeenCalledTimes(1)
    expect(mocked.initUploadSession).not.toHaveBeenCalled()
    expect(mocked.uploadChunkWithRetry).not.toHaveBeenCalled()
    expect(mocked.completeUploadSession).not.toHaveBeenCalled()
    expect(mocked.getUploadStatus).not.toHaveBeenCalled()
    expect(result.current.state.entries[0]).toMatchObject({ status: 'done', progress: 100 })
  })

  it('manda el archivo a la carpeta destino', async () => {
    const file = createFiles(1)[0]
    const { result } = await uploadOne(file, { folderId: 7, folderName: 'Fotos' })
    await waitFor(() => expect(statuses(result)).toEqual(['done']))

    expect(mocked.uploadFileDirect.mock.calls[0][0]).toEqual({ file, folderId: 7 })
  })

  it('el límite exacto va directo; un byte más va por sesión', async () => {
    const { result } = renderQueue()
    act(() => result.current.actions.openPanel(TARGET))
    act(() => {
      result.current.actions.addFiles([createFileOfSize('justo.bin.txt', DIRECT_UPLOAD_MAX_BYTES)])
    })
    await waitFor(() => expect(statuses(result)).toEqual(['done']))
    expect(mocked.uploadFileDirect).toHaveBeenCalledTimes(1)
    expect(mocked.initUploadSession).not.toHaveBeenCalled()

    act(() => {
      result.current.actions.addFiles([largeFile('grande.txt')])
    })
    await waitFor(() => expect(statuses(result)).toEqual(['done', 'done']), { timeout: 5_000 })
    expect(mocked.uploadFileDirect).toHaveBeenCalledTimes(1) // el grande NO fue directo
    expect(mocked.initUploadSession).toHaveBeenCalledTimes(1)
    expect(mocked.completeUploadSession).toHaveBeenCalledTimes(1)
  })

  describe('si la petición falla', () => {
    it('sin respuesta (red, stall): NO se reintenta sola, ni siquiera al volver la conexión', async () => {
      mocked.uploadFileDirect.mockRejectedValue(new ApiError(null, 'sin conexión'))
      const { result } = await uploadOne(createFiles(1)[0])
      await waitFor(() => expect(statuses(result)).toEqual(['error']))

      const entry = result.current.state.entries[0]
      expect(entry.error).toBe(UNCERTAIN_OUTCOME_MESSAGE)
      // `undefined` y no `null`: el reintento al volver la conexión solo recoge los `null` (§7.4)
      expect(entry.errorCode).toBeUndefined()

      act(() => {
        window.dispatchEvent(new Event('online'))
      })
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(mocked.uploadFileDirect).toHaveBeenCalledTimes(1)
      expect(statuses(result)).toEqual(['error'])
    })

    it('un 5xx tampoco: el servidor pudo guardar el archivo y fallar después', async () => {
      mocked.uploadFileDirect.mockRejectedValue(
        new ApiError(ApiErrorCodes.InternalError, 'fallo interno', { httpStatus: 500 }),
      )
      const { result } = await uploadOne(createFiles(1)[0])
      await waitFor(() => expect(statuses(result)).toEqual(['error']))
      expect(result.current.state.entries[0].error).toBe(UNCERTAIN_OUTCOME_MESSAGE)
      expect(mocked.uploadFileDirect).toHaveBeenCalledTimes(1)
    })

    it('el usuario SÍ puede reintentarlo a mano', async () => {
      mocked.uploadFileDirect.mockRejectedValueOnce(new ApiError(null, 'sin conexión'))
      const { result } = await uploadOne(createFiles(1)[0])
      await waitFor(() => expect(statuses(result)).toEqual(['error']))

      act(() => result.current.actions.retryEntry(result.current.state.entries[0].id))
      await waitFor(() => expect(statuses(result)).toEqual(['done']))
      expect(mocked.uploadFileDirect).toHaveBeenCalledTimes(2)
    })

    it('un rechazo claro del servidor (4xx) conserva su código y su mensaje', async () => {
      mocked.uploadFileDirect.mockRejectedValue(
        new ApiError(ApiErrorCodes.InvalidFileExtension, 'extensión no admitida', { httpStatus: 400 }),
      )
      const { result } = await uploadOne(createFiles(1)[0])
      await waitFor(() => expect(statuses(result)).toEqual(['error']))

      const entry = result.current.state.entries[0]
      expect(entry.error).toBe('extensión no admitida')
      expect(entry.errorCode).toBe(ApiErrorCodes.InvalidFileExtension)
      expect(mocked.uploadFileDirect).toHaveBeenCalledTimes(1)
    })

    it('un 429 SÍ se repite solo, tras la pausa: el rate limiter lo rechaza antes de crear nada', async () => {
      vi.useFakeTimers()
      mocked.uploadFileDirect
        .mockRejectedValueOnce(
          new ApiError(ApiErrorCodes.RateLimitExceeded, 'demasiadas', { httpStatus: 429, retryAfterMs: 1_000 }),
        )
        .mockResolvedValue(CREATED_FILE)

      const { result } = await uploadOne(createFiles(1)[0])
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      expect(statuses(result)).toEqual(['uploading']) // en pausa, no fallida
      expect(mocked.uploadFileDirect).toHaveBeenCalledTimes(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000)
      })
      expect(statuses(result)).toEqual(['done'])
      expect(mocked.uploadFileDirect).toHaveBeenCalledTimes(2)
    })
  })
})

describe('UploadQueueProvider — planificador por tipo de subida', () => {
  beforeEach(() => {
    mocked.uploadFileDirect.mockImplementation((_params, signal) => pendingUntilAborted(signal))
    mocked.initUploadSession.mockImplementation((_params, signal) => pendingUntilAborted(signal))
  })

  it('arranca a la vez tantas subidas directas como permite MAX_CONCURRENT_DIRECT_UPLOADS, y no más', async () => {
    const { result } = renderQueue()
    act(() => result.current.actions.openPanel(TARGET))
    act(() => {
      result.current.actions.addFiles(createFiles(pipeline.MAX_CONCURRENT_DIRECT_UPLOADS + 3))
    })

    await waitFor(() => expect(mocked.uploadFileDirect).toHaveBeenCalledTimes(pipeline.MAX_CONCURRENT_DIRECT_UPLOADS))
    expect(statuses(result).filter((s) => s === 'uploading')).toHaveLength(pipeline.MAX_CONCURRENT_DIRECT_UPLOADS)
    expect(statuses(result).filter((s) => s === 'queued')).toHaveLength(3)
  })

  it('un archivo grande esperando hueco no retiene a los pequeños de detrás', async () => {
    const files = [
      ...Array.from({ length: pipeline.MAX_CONCURRENT_CHUNKED_UPLOADS + 1 }, (_, i) => largeFile(`grande-${i}.txt`)),
      ...createFiles(1),
    ]
    const { result } = renderQueue()
    act(() => result.current.actions.openPanel(TARGET))
    act(() => {
      result.current.actions.addFiles(files)
    })

    await waitFor(() => expect(mocked.uploadFileDirect).toHaveBeenCalledTimes(1))
    const byName = (name: string) => result.current.state.entries.find((e) => e.file.name === name)?.status
    expect(byName(`grande-${pipeline.MAX_CONCURRENT_CHUNKED_UPLOADS}.txt`)).toBe('queued') // el grande sin hueco…
    expect(byName('archivo-0.txt')).toBe('uploading') // …no impide arrancar al pequeño que viene después
  })
})

describe('UploadQueueProvider — invalidaciones de caché agrupadas', () => {
  /** Pasa el tiempo en pasos cortos, dejando que se resuelvan las promesas entre uno y otro. */
  async function advance(totalMs: number) {
    for (let elapsed = 0; elapsed < totalMs; elapsed += 250) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250)
      })
    }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    let sessionCount = 0
    mocked.uploadFileDirect.mockResolvedValue(CREATED_FILE)
    mocked.initUploadSession.mockImplementation(async () => `sesion-${++sessionCount}`)
    mocked.uploadChunkWithRetry.mockResolvedValue(undefined)
    mocked.completeUploadSession.mockResolvedValue(undefined)
    mocked.getUploadStatus.mockResolvedValue(COMPLETED)
  })

  it('un solo archivo refresca listado y almacenamiento sin esperar', async () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderQueue()

    act(() => result.current.actions.openPanel(TARGET))
    act(() => {
      result.current.actions.addFiles(createFiles(1))
    })
    await advance(1_500)

    expect(result.current.state.entries[0].status).toBe('done')
    const keys = spy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey))
    expect(keys).toContain(JSON.stringify(filesKeys.contents(null)))
    expect(keys).toContain(JSON.stringify(filesKeys.storageUsage))
  })

  it('una subida por sesión (archivo grande) también refresca al terminar', async () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderQueue()

    act(() => result.current.actions.openPanel(TARGET))
    act(() => {
      result.current.actions.addFiles([largeFile('grande.txt')])
    })
    await advance(3_000) // incluye la primera consulta de estado, 1 s después de `complete`

    expect(result.current.state.entries[0].status).toBe('done')
    const keys = spy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey))
    expect(keys).toContain(JSON.stringify(filesKeys.contents(null)))
    expect(keys).toContain(JSON.stringify(filesKeys.storageUsage))
  })

  it('un lote de archivos NO invalida el almacenamiento una vez por archivo', async () => {
    const FILES = 12
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderQueue()

    act(() => result.current.actions.openPanel(TARGET))
    act(() => {
      result.current.actions.addFiles(createFiles(FILES))
    })
    await advance(30_000)

    expect(result.current.state.entries.every((e) => e.status === 'done')).toBe(true)
    const storageCalls = spy.mock.calls.filter(
      ([filters]) => JSON.stringify(filters?.queryKey) === JSON.stringify(filesKeys.storageUsage),
    ).length
    expect(storageCalls).toBeGreaterThanOrEqual(1)
    expect(storageCalls).toBeLessThan(FILES) // antes: exactamente FILES (una por archivo)
  })

  it('al terminar el último archivo refresca ya, sin esperar al cierre de la ventana', async () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderQueue()

    act(() => result.current.actions.openPanel(TARGET))
    act(() => {
      // Mezcla de directos y por sesión: los últimos en terminar llegan con la ventana ya abierta
      result.current.actions.addFiles([...createFiles(6), largeFile('grande-a.txt'), largeFile('grande-b.txt')])
    })
    // Se avanza en pasos cortos y se PARA en cuanto el último queda hecho: lo que importa es qué
    // pasó en ese instante, no 30 s después (un temporizador pendiente lo habría vaciado igualmente).
    for (let step = 0; step < 120 && !result.current.state.entries.every((e) => e.status === 'done'); step++) {
      await advance(250)
    }
    expect(result.current.state.entries.every((e) => e.status === 'done')).toBe(true)

    const callsWhenDone = spy.mock.calls.length
    await advance(10_000)
    expect(spy.mock.calls.length).toBe(callsWhenDone) // nada pendiente: el efecto de cola inactiva ya lo vació
  })
})

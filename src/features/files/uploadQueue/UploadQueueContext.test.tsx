import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/shared/api/client'
import { ApiErrorCodes, getErrorMessage } from '@/shared/api/errors'

import { filesKeys } from '../api'
import type { UploadFileResponse, UploadStatusResponse } from '../types'
import * as pipeline from './pipeline'
import { UploadQueueProvider, useUploadQueueActions, useUploadQueueState } from './UploadQueueContext'

// CLAUDE.md §9: el Provider no es visual, así que se prueba lo que no debe romperse sin
// que lo note el typecheck: que las acciones sigan siendo estables (la razón de tener
// dos Contexts, §7.4) y que las invalidaciones de caché se agrupen. La red se simula
// sustituyendo las llamadas HTTP de pipeline.ts; el resto (planificador, semáforos,
// pausa por rate limit, espera del ensamblado) es el real.
vi.mock('./pipeline', async (importOriginal) => {
  const original = await importOriginal<typeof import('./pipeline')>()
  return {
    ...original,
    initUploadSession: vi.fn(),
    uploadChunkWithRetry: vi.fn(),
    completeUploadSession: vi.fn(),
    getUploadStatus: vi.fn(),
    uploadSingleFile: vi.fn(),
    shouldUploadDirect: vi.fn(),
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

/** Una petición que nunca responde, pero que se aborta como lo haría axios al cancelar. */
function pendingUntilAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  })
}

const TARGET = { folderId: null, folderName: 'Archivos' }

function createFiles(count: number): File[] {
  return Array.from({ length: count }, (_, i) => new File(['contenido'], `archivo-${i}.txt`))
}

let queryClient: QueryClient

function renderQueue() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <UploadQueueProvider>{children}</UploadQueueProvider>
    </QueryClientProvider>
  )
  return renderHook(() => ({ state: useUploadQueueState(), actions: useUploadQueueActions() }), { wrapper })
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  mocked.initUploadSession.mockReset()
  mocked.uploadChunkWithRetry.mockReset()
  mocked.completeUploadSession.mockReset()
  mocked.getUploadStatus.mockReset()
  mocked.uploadSingleFile.mockReset()
  // Por defecto todo va por chunks (las pruebas de abajo ejercitan ese camino con
  // archivos de unos bytes); el bloque de la subida directa lo activa a propósito.
  mocked.shouldUploadDirect.mockReset().mockReturnValue(false)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('UploadQueueProvider — acciones estables', () => {
  beforeEach(() => {
    mocked.initUploadSession.mockImplementation((_params, signal) => pendingUntilAborted(signal))
  })

  it('las acciones conservan su identidad mientras el estado cambia', async () => {
    const { result } = renderQueue()
    const initialActions = result.current.actions
    const initialState = result.current.state

    act(() => result.current.actions.openPanel(TARGET))
    act(() => {
      result.current.actions.addFiles(createFiles(2))
    })
    await waitFor(() => expect(result.current.state.entries.map((e) => e.status)).toEqual(['uploading', 'uploading']))

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
      result.current.actions.addFiles(createFiles(3)) // MAX_CONCURRENT_UPLOADS = 2: la tercera espera
    })
    await waitFor(() =>
      expect(result.current.state.entries.map((e) => e.status)).toEqual(['uploading', 'uploading', 'queued']),
    )

    const [uploading, , queued] = result.current.state.entries
    act(() => result.current.actions.cancelEntry(queued.id))
    act(() => result.current.actions.cancelEntry(uploading.id))

    await waitFor(() => expect(result.current.state.entries[0].status).toBe('cancelled'))
    expect(result.current.state.entries[2].status).toBe('cancelled')
  })

  it('retryAllFailed (capturada antes del fallo) ve las entradas que fallaron después', async () => {
    mocked.initUploadSession
      .mockReset()
      .mockRejectedValueOnce(new ApiError(ApiErrorCodes.FileTooLarge, 'demasiado grande'))
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
    expect(mocked.initUploadSession).toHaveBeenCalledTimes(2)
  })
})

describe('UploadQueueProvider — errores de almacenamiento (1028 / 1029, CLAUDE.md §5.4)', () => {
  async function advance(totalMs: number) {
    for (let elapsed = 0; elapsed < totalMs; elapsed += 250) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250)
      })
    }
  }

  it('un 503/507 al iniciar deja la fila en error con su mensaje y NO se reintenta sola al volver la conexión', async () => {
    mocked.initUploadSession.mockRejectedValue(
      new ApiError(ApiErrorCodes.StorageLocationFull, getErrorMessage(ApiErrorCodes.StorageLocationFull), {
        httpStatus: 507,
      }),
    )
    const { result } = renderQueue()
    act(() => result.current.actions.openPanel(TARGET))
    act(() => {
      result.current.actions.addFiles(createFiles(1))
    })
    await waitFor(() => expect(result.current.state.entries[0]?.status).toBe('error'))

    const entry = result.current.state.entries[0]
    expect(entry.errorCode).toBe(ApiErrorCodes.StorageLocationFull)
    expect(entry.error).toBe('No hay espacio suficiente en el almacenamiento del servidor')

    // errorCode real = rechazo del servidor, no un corte de red: el efecto de 'online' no lo toca
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.state.entries[0].status).toBe('error')
    expect(mocked.initUploadSession).toHaveBeenCalledTimes(1)
  })

  it.each([ApiErrorCodes.StorageLocationUnavailable, ApiErrorCodes.StorageLocationFull])(
    'una sesión cancelada en segundo plano con %s se muestra con su mensaje y descarta la sesión muerta',
    async (errorCode) => {
      vi.useFakeTimers()
      mocked.initUploadSession.mockResolvedValue('sesion-muerta')
      mocked.uploadChunkWithRetry.mockResolvedValue(undefined)
      mocked.completeUploadSession.mockResolvedValue(undefined)
      mocked.getUploadStatus.mockResolvedValue({ ...COMPLETED, status: 'cancelled', errorCode })

      const { result } = renderQueue()
      act(() => result.current.actions.openPanel(TARGET))
      act(() => {
        result.current.actions.addFiles(createFiles(1))
      })
      await advance(3_000)

      const entry = result.current.state.entries[0]
      expect(entry.status).toBe('error')
      expect(entry.errorCode).toBe(errorCode)
      expect(entry.error).toBe(getErrorMessage(errorCode))
      // "Reintentar" empieza una subida nueva en vez de reanudar una sesión que ya no sirve
      expect(entry.sessionId).toBeUndefined()
    },
  )
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
      result.current.actions.addFiles(createFiles(6))
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

describe('UploadQueueProvider — subida directa de archivos pequeños (CLAUDE.md §7.4)', () => {
  const CREATED: UploadFileResponse = {
    id: 7,
    fileName: 'archivo-0.txt',
    sizeBytes: 9,
    contentType: 'text/plain',
    folderId: null,
    ownerId: 1,
    uploadedAt: '2026-11-22T10:00:00Z',
  }

  beforeEach(() => {
    mocked.shouldUploadDirect.mockReturnValue(true)
  })

  it('un archivo pequeño sube en UNA petición: sin sesión, sin chunks, sin complete ni sondeo', async () => {
    mocked.uploadSingleFile.mockResolvedValue(CREATED)
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderQueue()

    act(() => result.current.actions.openPanel(TARGET))
    act(() => {
      result.current.actions.addFiles(createFiles(1))
    })
    await waitFor(() => expect(result.current.state.entries[0]?.status).toBe('done'))

    expect(mocked.uploadSingleFile).toHaveBeenCalledTimes(1)
    expect(mocked.uploadSingleFile.mock.calls[0][1]).toBeNull() // carpeta destino: raíz
    expect(mocked.initUploadSession).not.toHaveBeenCalled()
    expect(mocked.uploadChunkWithRetry).not.toHaveBeenCalled()
    expect(mocked.completeUploadSession).not.toHaveBeenCalled()
    expect(mocked.getUploadStatus).not.toHaveBeenCalled()

    // Mismo refresco que el camino por chunks: listado de la carpeta y almacenamiento.
    const keys = spy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey))
    expect(keys).toContain(JSON.stringify(filesKeys.contents(null)))
    expect(keys).toContain(JSON.stringify(filesKeys.storageUsage))

    const entry = result.current.state.entries[0]
    expect(entry.sessionId).toBeUndefined()
    expect(entry.totalChunks).toBe(0) // sin tira de fragmentos en la fila
    expect(entry.progress).toBe(100)
  })

  it('el progreso se acota al tamaño del archivo aunque el envío cuente el sobre multipart', async () => {
    mocked.uploadSingleFile.mockImplementation(async (_file, _folder, _signal, onProgress) => {
      onProgress(1_000_000) // más que los 9 bytes del archivo
      await new Promise((resolve) => setTimeout(resolve, 20))
      return CREATED
    })
    const { result } = renderQueue()

    act(() => result.current.actions.openPanel(TARGET))
    act(() => {
      result.current.actions.addFiles(createFiles(1))
    })
    await waitFor(() => expect(result.current.state.entries[0]?.progress).toBe(100))
    expect(result.current.state.entries[0].status).not.toBe('error')
  })

  it('un archivo sin acceso al servidor (corte de red) se reintenta solo al volver la conexión', async () => {
    mocked.uploadSingleFile
      .mockRejectedValueOnce(new ApiError(null, 'sin conexión'))
      .mockResolvedValueOnce(CREATED)
    const { result } = renderQueue()

    act(() => result.current.actions.openPanel(TARGET))
    act(() => {
      result.current.actions.addFiles(createFiles(1))
    })
    await waitFor(() => expect(result.current.state.entries[0]?.status).toBe('error'))
    expect(result.current.state.entries[0].errorCode).toBeNull()

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => expect(result.current.state.entries[0].status).toBe('done'))
    expect(mocked.uploadSingleFile).toHaveBeenCalledTimes(2)
  })

  it('si el cuerpo llegó entero pero no hubo respuesta, NO se reintenta solo (duplicaría el archivo)', async () => {
    mocked.uploadSingleFile.mockRejectedValue(new pipeline.UploadOutcomeUnknownError())
    const { result } = renderQueue()

    act(() => result.current.actions.openPanel(TARGET))
    act(() => {
      result.current.actions.addFiles(createFiles(1))
    })
    await waitFor(() => expect(result.current.state.entries[0]?.status).toBe('error'))

    const entry = result.current.state.entries[0]
    expect(entry.errorCode).toBeUndefined() // ni null (red) ni un código de la API
    expect(entry.error).toContain('Revisa la carpeta')

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.state.entries[0].status).toBe('error')
    expect(mocked.uploadSingleFile).toHaveBeenCalledTimes(1)
  })

  it('un rechazo síncrono del servidor (p. ej. contenido que no coincide con la extensión) queda en la fila con su código', async () => {
    mocked.uploadSingleFile.mockRejectedValue(
      new ApiError(ApiErrorCodes.InvalidFileExtension, getErrorMessage(ApiErrorCodes.InvalidFileExtension), {
        httpStatus: 400,
      }),
    )
    const { result } = renderQueue()

    act(() => result.current.actions.openPanel(TARGET))
    act(() => {
      result.current.actions.addFiles(createFiles(1))
    })
    await waitFor(() => expect(result.current.state.entries[0]?.status).toBe('error'))

    expect(result.current.state.entries[0].errorCode).toBe(ApiErrorCodes.InvalidFileExtension)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(mocked.uploadSingleFile).toHaveBeenCalledTimes(1)
  })

  it('"Reintentar" una subida directa fallida vuelve a enviarla (sin sesión que reanudar)', async () => {
    mocked.uploadSingleFile
      .mockRejectedValueOnce(
        new ApiError(ApiErrorCodes.StorageLocationFull, 'sin espacio', { httpStatus: 507 }),
      )
      .mockResolvedValueOnce(CREATED)
    const { result } = renderQueue()

    act(() => result.current.actions.openPanel(TARGET))
    act(() => {
      result.current.actions.addFiles(createFiles(1))
    })
    await waitFor(() => expect(result.current.state.entries[0]?.status).toBe('error'))

    act(() => result.current.actions.retryEntry(result.current.state.entries[0].id))
    await waitFor(() => expect(result.current.state.entries[0].status).toBe('done'))
    expect(mocked.uploadSingleFile).toHaveBeenCalledTimes(2)
    expect(mocked.getUploadStatus).not.toHaveBeenCalled()
  })

  it('una subida directa cancelada libera su sitio y deja pasar a la siguiente', async () => {
    // MAX_CONCURRENT_UPLOADS = 2: dos peticiones abiertas a la vez y la tercera espera en cola.
    mocked.uploadSingleFile.mockImplementation((_file, _folder, signal) => pendingUntilAborted(signal))
    const { result } = renderQueue()

    act(() => result.current.actions.openPanel(TARGET))
    act(() => {
      result.current.actions.addFiles(createFiles(3))
    })
    await waitFor(() => expect(mocked.uploadSingleFile).toHaveBeenCalledTimes(2))
    expect(result.current.state.entries.map((e) => e.status)).toEqual(['uploading', 'uploading', 'queued'])

    act(() => result.current.actions.cancelEntry(result.current.state.entries[0].id))
    await waitFor(() => expect(mocked.uploadSingleFile).toHaveBeenCalledTimes(3))
    expect(result.current.state.entries[0].status).toBe('cancelled')
  })
})

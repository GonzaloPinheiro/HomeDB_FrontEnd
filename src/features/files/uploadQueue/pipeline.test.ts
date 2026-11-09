import type { AxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, api } from '@/shared/api/client'
import { ApiErrorCodes } from '@/shared/api/errors'

import {
  BACKEND_CHUNK_REQUEST_LIMIT_BYTES,
  CHUNK_SIZE_BYTES,
  MAX_PARALLEL_CHUNK_UPLOADS,
  STALL_TIMEOUT_MS,
  aggregateProgress,
  backoffDelayMs,
  computeChunkPlan,
  uploadChunkWithRetry,
  uploadFileDirect,
} from './pipeline'

describe('constantes de la subida por chunks', () => {
  it('un chunk cabe en el límite de la petición del backend con margen para el sobre multipart', () => {
    // Si alguien sube CHUNK_SIZE_BYTES por encima, el backend responde 413 y
    // ninguna subida de más de un chunk funciona: este test lo evita (§7.4).
    const multipartOverheadMarginBytes = 1024 * 1024
    expect(CHUNK_SIZE_BYTES + multipartOverheadMarginBytes).toBeLessThanOrEqual(BACKEND_CHUNK_REQUEST_LIMIT_BYTES)
  })

  it('el paralelismo es un entero positivo', () => {
    expect(Number.isInteger(MAX_PARALLEL_CHUNK_UPLOADS)).toBe(true)
    expect(MAX_PARALLEL_CHUNK_UPLOADS).toBeGreaterThanOrEqual(1)
  })
})

describe('computeChunkPlan', () => {
  it('reparte un archivo exacto en chunks del mismo tamaño', () => {
    const plan = computeChunkPlan(30, 10)
    expect(plan.totalChunks).toBe(3)
    expect(plan.chunkSizes).toEqual([10, 10, 10])
  })

  it('el último chunk se queda con el resto cuando no divide exacto', () => {
    const plan = computeChunkPlan(25, 10)
    expect(plan.totalChunks).toBe(3)
    expect(plan.chunkSizes).toEqual([10, 10, 5])
  })

  it('un archivo menor que un chunk produce un único chunk con su tamaño real', () => {
    const plan = computeChunkPlan(5, 10)
    expect(plan.totalChunks).toBe(1)
    expect(plan.chunkSizes).toEqual([5])
  })

  it('nunca produce 0 chunks, ni con tamaño 0 (defensivo)', () => {
    const plan = computeChunkPlan(0, 10)
    expect(plan.totalChunks).toBe(1)
  })
})

describe('backoffDelayMs', () => {
  it('crece exponencialmente a partir de 500ms', () => {
    expect(backoffDelayMs(1)).toBe(500)
    expect(backoffDelayMs(2)).toBe(1000)
    expect(backoffDelayMs(3)).toBe(2000)
  })
})

describe('aggregateProgress', () => {
  const chunkSizes = [10, 10, 5] // total 25

  it('0% sin ningún chunk confirmado ni progreso parcial', () => {
    expect(aggregateProgress(chunkSizes, [0, 0, 0], 25)).toBe(0)
  })

  it('suma los chunks confirmados más el progreso parcial del chunk en curso', () => {
    // 1 chunk confirmado (10 bytes) + 4 bytes subidos del segundo chunk, sobre 25 totales
    expect(aggregateProgress(chunkSizes, [10, 4, 0], 25)).toBe(Math.round((14 / 25) * 100))
  })

  it('suma el progreso parcial de varios chunks en vuelo a la vez', () => {
    expect(aggregateProgress(chunkSizes, [3, 4, 2], 25)).toBe(Math.round((9 / 25) * 100))
  })

  it('cuenta chunks confirmados que no son un prefijo (paralelo o reanudación)', () => {
    // El 1º y el 3º confirmados, el 2º sin empezar
    expect(aggregateProgress(chunkSizes, [10, 0, 5], 25)).toBe(60)
  })

  it('100% con todos los chunks confirmados', () => {
    expect(aggregateProgress(chunkSizes, [10, 10, 5], 25)).toBe(100)
  })

  it('acota cada chunk a su tamaño: el sobre multipart no hace pasarse (defensivo)', () => {
    expect(aggregateProgress(chunkSizes, [999, 0, 0], 25)).toBe(40)
    expect(aggregateProgress(chunkSizes, [999, 999, 999], 25)).toBe(100)
  })

  it('trata como 0 un chunk sin entrada o con valor negativo', () => {
    expect(aggregateProgress(chunkSizes, [10], 25)).toBe(40)
    expect(aggregateProgress(chunkSizes, [-5, 0, 0], 25)).toBe(0)
  })

  it('0% si el tamaño total es inválido, sin dividir por cero', () => {
    expect(aggregateProgress(chunkSizes, [0, 0, 0], 0)).toBe(0)
  })
})

// ---------------------------------------------------------------------------------------
// Transporte: lo que se manda por la red. Los chunks y la subida directa comparten el POST
// multipart con el control de conexión colgada (postFormWithStallGuard); estas pruebas
// fijan el contrato de cada uno con `api.post` simulado, sin servidor.
// ---------------------------------------------------------------------------------------

const CREATED_FILE = {
  id: 9,
  fileName: 'a.txt',
  sizeBytes: 3,
  contentType: 'text/plain',
  folderId: null,
  ownerId: 1,
  uploadedAt: '2026-11-09T10:00:00Z',
}
const envelope = (data: unknown) => ({ data: { result: true, data, errorCode: null, errorMessage: null } })

type PostArgs = [url: string, body: FormData, config: AxiosRequestConfig]
const lastPost = (spy: { mock: { calls: unknown[][] } }): PostArgs => spy.mock.calls.at(-1) as unknown as PostArgs

/** Una petición que nunca responde, pero que se corta con el signal como lo haría axios. */
function hangUntilAborted(config: AxiosRequestConfig) {
  return new Promise((_resolve, reject) => {
    config.signal?.addEventListener?.('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  })
}

describe('uploadFileDirect — POST /files', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('manda el archivo en el campo `file` y la carpeta en `folderId`', async () => {
    const spy = vi.spyOn(api, 'post').mockResolvedValue(envelope(CREATED_FILE))
    const file = new File(['abc'], 'a.txt')

    await uploadFileDirect({ file, folderId: 42 }, new AbortController().signal, () => {})

    const [url, body, config] = lastPost(spy)
    expect(url).toBe('/files')
    expect((body.get('file') as File).name).toBe('a.txt')
    expect(body.get('folderId')).toBe('42')
    expect(config.timeout).toBe(0) // sin techo de duración total: lo controla el stall
  })

  it('en la raíz NO manda `folderId` (nunca el texto "null")', async () => {
    const spy = vi.spyOn(api, 'post').mockResolvedValue(envelope(CREATED_FILE))

    await uploadFileDirect({ file: new File(['abc'], 'a.txt'), folderId: null }, new AbortController().signal, () => {})

    expect(lastPost(spy)[1].has('folderId')).toBe(false)
  })

  it('devuelve el archivo creado, ya validado', async () => {
    vi.spyOn(api, 'post').mockResolvedValue(envelope(CREATED_FILE))
    const created = await uploadFileDirect(
      { file: new File(['abc'], 'a.txt'), folderId: null },
      new AbortController().signal,
      () => {},
    )
    expect(created).toEqual(CREATED_FILE)
  })

  it('una respuesta con otra forma falla (no se da por buena)', async () => {
    vi.spyOn(api, 'post').mockResolvedValue(envelope({ id: 'no es un número' }))
    await expect(
      uploadFileDirect({ file: new File(['abc'], 'a.txt'), folderId: null }, new AbortController().signal, () => {}),
    ).rejects.toThrow()
  })

  it('un `result: false` lanza el error del servidor con su código', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({
      data: { result: false, data: null, errorCode: ApiErrorCodes.InvalidFileExtension, errorMessage: 'x' },
    })
    await expect(
      uploadFileDirect({ file: new File(['abc'], 'a.txt'), folderId: null }, new AbortController().signal, () => {}),
    ).rejects.toMatchObject({ errorCode: ApiErrorCodes.InvalidFileExtension })
  })

  it('NO se reintenta sola: no es idempotente, repetirla duplicaría el archivo', async () => {
    const spy = vi.spyOn(api, 'post').mockRejectedValue(new ApiError(null, 'sin conexión'))
    await expect(
      uploadFileDirect({ file: new File(['abc'], 'a.txt'), folderId: null }, new AbortController().signal, () => {}),
    ).rejects.toBeInstanceOf(ApiError)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('transmite el progreso de envío', async () => {
    vi.spyOn(api, 'post').mockImplementation(async (_url, _body, config) => {
      config?.onUploadProgress?.({ loaded: 1234 } as never)
      return envelope(CREATED_FILE)
    })
    const onProgress = vi.fn()
    await uploadFileDirect({ file: new File(['abc'], 'a.txt'), folderId: null }, new AbortController().signal, onProgress)
    expect(onProgress).toHaveBeenCalledWith(1234)
  })

  describe('conexión colgada (stall)', () => {
    it(`se aborta tras ${STALL_TIMEOUT_MS / 1000} s sin progreso`, async () => {
      vi.useFakeTimers()
      vi.spyOn(api, 'post').mockImplementation((_url, _body, config) => hangUntilAborted(config ?? {}))
      const result = uploadFileDirect(
        { file: new File(['abc'], 'a.txt'), folderId: null },
        new AbortController().signal,
        () => {},
      )
      const settled = expect(result).rejects.toBeDefined()

      await vi.advanceTimersByTimeAsync(STALL_TIMEOUT_MS - 1)
      await vi.advanceTimersByTimeAsync(1)
      await settled
    })

    it('mientras llega progreso NO se aborta, aunque tarde mucho más que el timeout', async () => {
      vi.useFakeTimers()
      let config: AxiosRequestConfig = {}
      vi.spyOn(api, 'post').mockImplementation((_url, _body, requestConfig) => {
        config = requestConfig ?? {}
        return hangUntilAborted(config)
      })
      const result = uploadFileDirect(
        { file: new File(['abc'], 'a.txt'), folderId: null },
        new AbortController().signal,
        () => {},
      )
      result.catch(() => {})

      // 5 × 15 s = 75 s en total, pero con progreso cada 15 s: nunca hay 20 s seguidos sin avanzar
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(15_000)
        config.onUploadProgress?.({ loaded: i + 1 } as never)
      }
      expect(config.signal?.aborted).toBe(false)
    })

    it('cancelar desde fuera corta la petición', async () => {
      const outer = new AbortController()
      let config: AxiosRequestConfig = {}
      vi.spyOn(api, 'post').mockImplementation((_url, _body, requestConfig) => {
        config = requestConfig ?? {}
        return hangUntilAborted(config)
      })
      const result = uploadFileDirect({ file: new File(['abc'], 'a.txt'), folderId: null }, outer.signal, () => {})
      const settled = expect(result).rejects.toBeDefined()

      outer.abort()
      await settled
      expect(config.signal?.aborted).toBe(true)
    })
  })
})

describe('uploadChunkWithRetry — POST /files/upload/chunk (sin cambios tras compartir el transporte)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('manda sessionId, chunkNumber y el chunk en un multipart, sin timeout total', async () => {
    const spy = vi.spyOn(api, 'post').mockResolvedValue(envelope('ok'))
    const blob = new Blob(['datos'])

    await uploadChunkWithRetry('sesion-1', 3, blob, new AbortController().signal, () => {})

    const [url, body, config] = lastPost(spy)
    expect(url).toBe('/files/upload/chunk')
    expect(body.get('sessionId')).toBe('sesion-1')
    expect(body.get('chunkNumber')).toBe('3')
    expect((body.get('chunk') as Blob).size).toBe(blob.size)
    expect(config.timeout).toBe(0)
  })

  it('SÍ reintenta un fallo transitorio (un chunk es idempotente), con backoff', async () => {
    vi.useFakeTimers()
    const spy = vi
      .spyOn(api, 'post')
      .mockRejectedValueOnce(new ApiError(null, 'corte'))
      .mockResolvedValue(envelope('ok'))

    const result = uploadChunkWithRetry('s', 1, new Blob(['x']), new AbortController().signal, () => {})
    await vi.advanceTimersByTimeAsync(backoffDelayMs(1))
    await result

    expect(spy).toHaveBeenCalledTimes(2)
  })
})

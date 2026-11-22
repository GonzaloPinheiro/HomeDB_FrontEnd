import { AxiosError } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/shared/api/client'
import { ApiErrorCodes } from '@/shared/api/errors'

import {
  BACKEND_CHUNK_REQUEST_LIMIT_BYTES,
  BACKEND_SINGLE_UPLOAD_MAX_FILE_BYTES,
  CHUNK_SIZE_BYTES,
  DIRECT_UPLOAD_MAX_BYTES,
  MAX_PARALLEL_CHUNK_UPLOADS,
  UploadOutcomeUnknownError,
  aggregateProgress,
  backoffDelayMs,
  computeChunkPlan,
  shouldUploadDirect,
  uploadChunkWithRetry,
  uploadSingleFile,
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

describe('uploadChunkWithRetry — qué errores se reintentan (CLAUDE.md §7.4)', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function failure(status: number | null, errorCode: number | null) {
    const error = new AxiosError(status === null ? 'Network Error' : `status ${status}`)
    if (status !== null) {
      error.response = {
        status,
        data: { result: false, data: null, errorCode, errorMessage: 'x' },
      } as never
    }
    return error
  }

  async function run(post: ReturnType<typeof vi.spyOn>) {
    vi.useFakeTimers()
    const outcome = uploadChunkWithRetry('sesion', 1, new Blob(['x']), new AbortController().signal, () => undefined)
    const settled = outcome.then(
      () => 'ok',
      (error: unknown) => error,
    )
    await vi.runAllTimersAsync()
    return { result: await settled, calls: post.mock.calls.length }
  }

  it.each([
    ['1028 (disco temporal caído)', 503, ApiErrorCodes.StorageLocationUnavailable],
    ['1029 (disco temporal sin espacio)', 507, ApiErrorCodes.StorageLocationFull],
  ])('no reintenta un %s: un disco caído no vuelve en unos segundos', async (_label, status, errorCode) => {
    const post = vi.spyOn(api, 'post').mockRejectedValue(failure(status, errorCode))
    const { result, calls } = await run(post)
    expect(calls).toBe(1)
    expect(result).toMatchObject({ errorCode })
  })

  it('sigue reintentando un corte de red (sin respuesta) hasta el máximo de intentos', async () => {
    const post = vi.spyOn(api, 'post').mockRejectedValue(failure(null, null))
    const { calls } = await run(post)
    expect(calls).toBe(3)
  })
})

describe('constantes de la subida directa (CLAUDE.md §7.4)', () => {
  it('el umbral del front cabe en el límite de archivo del backend', () => {
    // Si alguien sube DIRECT_UPLOAD_MAX_BYTES por encima, el backend responde 413 a
    // archivos que el front manda por la vía directa (UploadLimits.SingleUploadMaxFileBytes).
    expect(DIRECT_UPLOAD_MAX_BYTES).toBeLessThanOrEqual(BACKEND_SINGLE_UPLOAD_MAX_FILE_BYTES)
  })

  it('un archivo directo cabe en UNA petición de chunk: nunca habría hecho falta trocearlo', () => {
    expect(computeChunkPlan(DIRECT_UPLOAD_MAX_BYTES).totalChunks).toBe(1)
  })

  it('shouldUploadDirect: el umbral es inclusivo y un archivo vacío no va por esta vía', () => {
    expect(shouldUploadDirect(1)).toBe(true)
    expect(shouldUploadDirect(DIRECT_UPLOAD_MAX_BYTES)).toBe(true)
    expect(shouldUploadDirect(DIRECT_UPLOAD_MAX_BYTES + 1)).toBe(false)
    expect(shouldUploadDirect(0)).toBe(false)
  })
})

describe('uploadSingleFile — contrato y reintentos (CLAUDE.md §5.4, §7.4)', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const CREATED = {
    id: 7,
    fileName: 'a.png',
    sizeBytes: 3,
    contentType: 'image/png',
    folderId: 4,
    ownerId: 1,
    uploadedAt: '2026-11-22T10:00:00Z',
  }
  const FILE = new File(['abc'], 'a.png', { type: 'image/png' })

  function failure(status: number | null, errorCode: number | null) {
    const error = new AxiosError(status === null ? 'Network Error' : `status ${status}`)
    if (status !== null) {
      error.response = {
        status,
        data: { result: false, data: null, errorCode, errorMessage: 'x' },
      } as never
    }
    return error
  }

  /** Simula un corte de red: `sentBytes` llegan a notificarse antes de que la petición falle. */
  function networkDropAfter(sentBytes: number, totalBytes: number) {
    return (_url: string, _data: unknown, config?: { onUploadProgress?: (event: unknown) => void }) => {
      config?.onUploadProgress?.({ loaded: sentBytes, total: totalBytes })
      return Promise.reject(failure(null, null))
    }
  }

  async function run(post: ReturnType<typeof vi.spyOn>) {
    vi.useFakeTimers()
    const settled = uploadSingleFile(FILE, 4, new AbortController().signal, () => undefined).then(
      (value) => ({ ok: value }),
      (error: unknown) => ({ error }),
    )
    await vi.runAllTimersAsync()
    return { outcome: await settled, calls: post.mock.calls.length }
  }

  it('envía el archivo y la carpeta a POST /files/upload/single y devuelve el archivo creado', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { result: true, data: CREATED, errorCode: null, errorMessage: null } })

    const created = await uploadSingleFile(FILE, 4, new AbortController().signal, () => undefined)

    expect(created).toEqual(CREATED)
    const [url, body, config] = post.mock.calls[0] as [string, FormData, { timeout: number }]
    expect(url).toBe('/files/upload/single')
    expect((body.get('file') as File).name).toBe('a.png')
    expect(body.get('folderId')).toBe('4')
    expect(config.timeout).toBe(0) // sin techo de duración total, igual que un chunk
  })

  it('en la raíz no envía folderId (ausente = raíz para el backend)', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { result: true, data: CREATED, errorCode: null, errorMessage: null } })

    await uploadSingleFile(FILE, null, new AbortController().signal, () => undefined)

    const body = post.mock.calls[0][1] as FormData
    expect(body.has('folderId')).toBe(false)
  })

  it.each([
    ['1027 (contenido que no coincide con la extensión)', 400, ApiErrorCodes.InvalidFileExtension],
    ['1004 (supera el tamaño máximo)', 413, ApiErrorCodes.FileTooLarge],
    ['1002 (la carpeta no existe)', 404, ApiErrorCodes.FolderNotFound],
    ['1028 (disco caído)', 503, ApiErrorCodes.StorageLocationUnavailable],
    ['1029 (sin espacio)', 507, ApiErrorCodes.StorageLocationFull],
    ['un 5xx genérico', 500, ApiErrorCodes.InternalError],
  ])('una respuesta del backend (%s) se propaga sin reintentar', async (_label, status, errorCode) => {
    const post = vi.spyOn(api, 'post').mockRejectedValue(failure(status, errorCode))
    const { outcome, calls } = await run(post)
    expect(calls).toBe(1)
    expect(outcome).toMatchObject({ error: { errorCode } })
  })

  it('un 429 se propaga sin reintentar aquí (la pausa global lo repite, rateLimit.ts)', async () => {
    const post = vi.spyOn(api, 'post').mockRejectedValue(failure(429, ApiErrorCodes.RateLimitExceeded))
    const { outcome, calls } = await run(post)
    expect(calls).toBe(1)
    expect(outcome).toMatchObject({ error: { httpStatus: 429 } })
  })

  it('un corte de red ANTES de terminar de enviar se reintenta (repetir es seguro) hasta el máximo', async () => {
    const post = vi.spyOn(api, 'post').mockImplementation(networkDropAfter(1, 3) as never)
    const { outcome, calls } = await run(post)
    expect(calls).toBe(3)
    expect(outcome).toMatchObject({ error: { errorCode: null } }) // error de red: lo reintenta solo el evento 'online'
  })

  it('un corte sin ningún evento de progreso también cuenta como "no enviado"', async () => {
    const post = vi.spyOn(api, 'post').mockRejectedValue(failure(null, null))
    const { calls } = await run(post)
    expect(calls).toBe(3)
  })

  it('un corte DESPUÉS de enviar el cuerpo entero no se reintenta: el resultado es desconocido (duplicaría)', async () => {
    const post = vi.spyOn(api, 'post').mockImplementation(networkDropAfter(3, 3) as never)
    const { outcome, calls } = await run(post)
    expect(calls).toBe(1)
    expect(outcome).toMatchObject({ error: expect.any(UploadOutcomeUnknownError) })
  })

  it('cancelar por el usuario se propaga de inmediato, sin reintentos ni resultado desconocido', async () => {
    const controller = new AbortController()
    const post = vi.spyOn(api, 'post').mockImplementation(((_url: string, _data: unknown, config?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        config?.signal?.addEventListener('abort', () => reject(new AxiosError('canceled', 'ERR_CANCELED')))
      })) as never)

    vi.useFakeTimers()
    const settled = uploadSingleFile(FILE, 4, controller.signal, () => undefined).then(
      () => 'ok',
      (error: unknown) => error,
    )
    controller.abort()
    await vi.runAllTimersAsync()

    expect(post).toHaveBeenCalledTimes(1)
    expect(await settled).not.toBeInstanceOf(UploadOutcomeUnknownError)
  })
})

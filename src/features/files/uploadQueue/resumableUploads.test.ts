import { describe, expect, it } from 'vitest'

import {
  MAX_RESUMABLE_RECORDS,
  RESUMABLE_MAX_AGE_MS,
  ResumableStore,
  findResumable,
  isSameFile,
  parseResumableUploads,
  resumableStorageKey,
  type ResumableQuery,
  type ResumableUpload,
  type StorageLike,
} from './resumableUploads'

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

function memoryStorage(
  initial: Record<string, string> = {},
): StorageLike & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value
    },
  }
}

const KEY = resumableStorageKey(1)

describe('resumableStorageKey', () => {
  it('separa a los usuarios del mismo navegador', () => {
    expect(resumableStorageKey(1)).not.toBe(resumableStorageKey(2))
  })
})

describe('parseResumableUploads', () => {
  it('sin nada guardado, devuelve vacío', () => {
    expect(parseResumableUploads(null, NOW)).toEqual([])
    expect(parseResumableUploads('', NOW)).toEqual([])
  })

  it('JSON roto o que no es una lista no tumba nada', () => {
    expect(parseResumableUploads('{no es json', NOW)).toEqual([])
    expect(parseResumableUploads('{"a":1}', NOW)).toEqual([])
  })

  it('un registro corrupto se ignora sin llevarse por delante a los demás', () => {
    const raw = JSON.stringify([
      record({ sessionId: 'a' }),
      { sessionId: 'b' },
      42,
      record({ sessionId: 'c' }),
    ])
    expect(parseResumableUploads(raw, NOW).map((r) => r.sessionId)).toEqual(['a', 'c'])
  })

  it('descarta los registros más viejos que el tope, y conserva los del límite', () => {
    const raw = JSON.stringify([
      record({ sessionId: 'viejo', createdAt: NOW - RESUMABLE_MAX_AGE_MS - 1 }),
      record({ sessionId: 'justo', createdAt: NOW - RESUMABLE_MAX_AGE_MS }),
    ])
    expect(parseResumableUploads(raw, NOW).map((r) => r.sessionId)).toEqual(['justo'])
  })
})

describe('ResumableStore', () => {
  it('guarda y recupera un registro', () => {
    const store = new ResumableStore(memoryStorage(), KEY, () => NOW)
    store.upsert(record())
    expect(store.list()).toEqual([record()])
  })

  it('upsert sobre la misma sesión la sustituye, no la duplica', () => {
    const store = new ResumableStore(memoryStorage(), KEY, () => NOW)
    store.upsert(record({ totalChunks: 4 }))
    store.upsert(record({ totalChunks: 9 }))
    expect(store.list()).toHaveLength(1)
    expect(store.list()[0].totalChunks).toBe(9)
  })

  it('setPhase cambia solo la fase de esa sesión', () => {
    const store = new ResumableStore(memoryStorage(), KEY, () => NOW)
    store.upsert(record({ sessionId: 'a' }))
    store.upsert(record({ sessionId: 'b' }))
    store.setPhase('a', 'processing')
    expect(store.list().map((r) => [r.sessionId, r.phase])).toEqual([
      ['a', 'processing'],
      ['b', 'uploading'],
    ])
  })

  it('setPhase y remove sobre una sesión desconocida no hacen nada ni escriben', () => {
    const storage = memoryStorage()
    const store = new ResumableStore(storage, KEY, () => NOW)
    store.setPhase('nada', 'processing')
    store.remove('nada')
    expect(storage.data[KEY]).toBeUndefined()
  })

  it('remove quita solo esa sesión', () => {
    const store = new ResumableStore(memoryStorage(), KEY, () => NOW)
    store.upsert(record({ sessionId: 'a' }))
    store.upsert(record({ sessionId: 'b' }))
    store.remove('a')
    expect(store.list().map((r) => r.sessionId)).toEqual(['b'])
  })

  it('se acota a MAX_RESUMABLE_RECORDS descartando los más antiguos', () => {
    const store = new ResumableStore(memoryStorage(), KEY, () => NOW)
    for (let i = 0; i < MAX_RESUMABLE_RECORDS + 5; i++) store.upsert(record({ sessionId: `s${i}` }))
    const ids = store.list().map((r) => r.sessionId)
    expect(ids).toHaveLength(MAX_RESUMABLE_RECORDS)
    expect(ids[0]).toBe('s5')
    expect(ids.at(-1)).toBe(`s${MAX_RESUMABLE_RECORDS + 4}`)
  })

  it('cada usuario ve solo lo suyo', () => {
    const storage = memoryStorage()
    new ResumableStore(storage, resumableStorageKey(1), () => NOW).upsert(
      record({ sessionId: 'mia' }),
    )
    expect(new ResumableStore(storage, resumableStorageKey(2), () => NOW).list()).toEqual([])
  })

  describe('si el almacenamiento falla, nada revienta', () => {
    it('sin almacenamiento (null)', () => {
      const store = new ResumableStore(null, KEY, () => NOW)
      expect(() => {
        store.upsert(record())
        store.setPhase('s1', 'processing')
        store.remove('s1')
      }).not.toThrow()
      expect(store.list()).toEqual([])
    })

    it('si leer lanza', () => {
      const store = new ResumableStore(
        {
          getItem: () => {
            throw new Error('SecurityError')
          },
          setItem: () => {},
        },
        KEY,
        () => NOW,
      )
      expect(store.list()).toEqual([])
    })

    it('si escribir lanza (cuota llena)', () => {
      const store = new ResumableStore(
        {
          getItem: () => null,
          setItem: () => {
            throw new Error('QuotaExceededError')
          },
        },
        KEY,
        () => NOW,
      )
      expect(() => store.upsert(record())).not.toThrow()
    })
  })
})

describe('isSameFile', () => {
  const file = new File(['x'.repeat(100)], 'peli.mp4', { lastModified: 1234 })

  it('coincide con nombre, tamaño y fecha', () => {
    expect(isSameFile(record(), file)).toBe(true)
  })

  it('cualquier diferencia lo hace otro archivo', () => {
    expect(isSameFile(record({ fileName: 'otra.mp4' }), file)).toBe(false)
    expect(isSameFile(record({ size: 99 }), file)).toBe(false)
    expect(isSameFile(record({ lastModified: 1 }), file)).toBe(false)
  })
})

describe('findResumable', () => {
  const query: ResumableQuery = {
    fileName: 'peli.mp4',
    size: 100,
    lastModified: 1234,
    chunkSizeBytes: 32,
    totalChunks: 4,
    folderId: 7,
  }
  const none = new Set<string>()

  it('encuentra el registro que coincide en todo', () => {
    expect(findResumable([record()], query, none)?.sessionId).toBe('s1')
  })

  it.each([
    ['nombre', { fileName: 'otra.mp4' }],
    ['tamaño', { size: 101 }],
    ['fecha de modificación', { lastModified: 9 }],
    ['carpeta', { folderId: 8 }],
    ['carpeta raíz frente a una carpeta', { folderId: null }],
    ['número de chunks', { totalChunks: 5 }],
  ] as const)('no reanuda si cambia el %s', (_label, change) => {
    expect(findResumable([record()], { ...query, ...change }, none)).toBeUndefined()
  })

  it('NO reanuda si cambió el tamaño de chunk: los números de chunk ya no significan lo mismo', () => {
    // Mismo archivo, mismo nº de chunks (4), pero cortado con otro tamaño: reanudar
    // mezclaría trozos de dos cortes distintos y daría un archivo corrupto.
    expect(findResumable([record({ chunkSizeBytes: 24 })], query, none)).toBeUndefined()
  })

  it('solo reanuda sesiones que esperan chunks, no las que el servidor ya está ensamblando', () => {
    expect(findResumable([record({ phase: 'processing' })], query, none)).toBeUndefined()
  })

  it('no reanuda una sesión ya reclamada por otra subida', () => {
    expect(findResumable([record()], query, new Set(['s1']))).toBeUndefined()
  })

  it('con varias candidatas elige la más reciente', () => {
    const found = findResumable(
      [record({ sessionId: 'vieja', createdAt: 1 }), record({ sessionId: 'nueva', createdAt: 2 })],
      query,
      none,
    )
    expect(found?.sessionId).toBe('nueva')
  })
})

import { describe, expect, it, vi } from 'vitest'

import { FolderResolver, type FolderRequests } from './folderResolver'

const signal = () => new AbortController().signal

/** Cede el turno al bucle de eventos, para dejar que otras tareas avancen. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

type ServerFolder = { id: number; name: string; parentId: number | null }

/**
 * Servidor en memoria con el comportamiento real del backend: `POST /folders` NO
 * comprueba duplicados (crea otra con el mismo nombre) y devuelve ids nuevos.
 */
function fakeServer(initial: ServerFolder[] = []) {
  const folders = [...initial]
  let nextId = Math.max(0, ...initial.map((f) => f.id)) + 1
  const listSubfolders = vi.fn(async (parentId: number | null) =>
    folders.filter((f) => f.parentId === parentId).map(({ id, name }) => ({ id, name })),
  )
  const createFolder = vi.fn(async (name: string, parentId: number | null) => {
    const id = nextId++
    folders.push({ id, name, parentId })
    return id
  })
  const requests: FolderRequests = { listSubfolders, createFolder }
  return { folders, listSubfolders, createFolder, requests }
}

describe('FolderResolver', () => {
  it('con una ruta vacía devuelve la carpeta base sin pedir nada', async () => {
    const server = fakeServer()
    const resolver = new FolderResolver(server.requests)
    expect(await resolver.resolve(7, [], signal())).toBe(7)
    expect(await resolver.resolve(null, [], signal())).toBeNull()
    expect(server.listSubfolders).not.toHaveBeenCalled()
    expect(server.createFolder).not.toHaveBeenCalled()
  })

  it('crea las carpetas que faltan, de fuera adentro, y devuelve la última', async () => {
    const server = fakeServer([{ id: 1, name: 'Documentos', parentId: null }])
    const resolver = new FolderResolver(server.requests)

    const id = await resolver.resolve(1, ['Fotos', '2024', 'Verano'], signal())

    expect(server.createFolder.mock.calls).toEqual([
      ['Fotos', 1],
      ['2024', 2],
      ['Verano', 3],
    ])
    expect(id).toBe(4)
  })

  it('reutiliza una carpeta existente con ese nombre exacto en vez de duplicarla', async () => {
    const server = fakeServer([
      { id: 1, name: 'Fotos', parentId: null },
      { id: 2, name: '2024', parentId: 1 },
    ])
    const resolver = new FolderResolver(server.requests)

    expect(await resolver.resolve(null, ['Fotos', '2024'], signal())).toBe(2)
    expect(server.createFolder).not.toHaveBeenCalled()
  })

  it('crea solo la parte que falta de una ruta parcialmente existente', async () => {
    const server = fakeServer([{ id: 1, name: 'Fotos', parentId: null }])
    const resolver = new FolderResolver(server.requests)

    await resolver.resolve(null, ['Fotos', 'Nueva'], signal())

    expect(server.createFolder.mock.calls).toEqual([['Nueva', 1]])
  })

  it('distingue mayúsculas: "fotos" no es "Fotos"', async () => {
    const server = fakeServer([{ id: 1, name: 'Fotos', parentId: null }])
    const resolver = new FolderResolver(server.requests)

    const id = await resolver.resolve(null, ['fotos'], signal())

    expect(id).not.toBe(1)
    expect(server.createFolder).toHaveBeenCalledWith('fotos', null)
  })

  it('con nombres repetidos en el servidor elige siempre la más antigua (menor id)', async () => {
    const server = fakeServer([
      { id: 9, name: 'Fotos', parentId: null },
      { id: 3, name: 'Fotos', parentId: null },
      { id: 5, name: 'Fotos', parentId: null },
    ])
    const resolver = new FolderResolver(server.requests)
    expect(await resolver.resolve(null, ['Fotos'], signal())).toBe(3)
  })

  it('no mezcla una carpeta con el mismo nombre bajo otro padre', async () => {
    const server = fakeServer([
      { id: 1, name: 'A', parentId: null },
      { id: 2, name: 'B', parentId: null },
      { id: 3, name: 'Fotos', parentId: 1 },
    ])
    const resolver = new FolderResolver(server.requests)

    const id = await resolver.resolve(2, ['Fotos'], signal())

    expect(id).not.toBe(3)
    expect(server.createFolder).toHaveBeenCalledWith('Fotos', 2)
  })

  describe('concurrencia', () => {
    it('muchos archivos que necesitan la misma carpeta nueva la crean UNA sola vez', async () => {
      const server = fakeServer()
      const resolver = new FolderResolver(server.requests)

      const ids = await Promise.all(
        Array.from({ length: 8 }, () => resolver.resolve(null, ['Fotos', '2024'], signal())),
      )

      expect(new Set(ids).size).toBe(1)
      expect(server.createFolder).toHaveBeenCalledTimes(2) // "Fotos" y "2024", no 16
      expect(server.folders.filter((f) => f.name === 'Fotos')).toHaveLength(1)
    })

    it('rutas distintas con un tramo común comparten ese tramo', async () => {
      const server = fakeServer()
      const resolver = new FolderResolver(server.requests)

      await Promise.all([
        resolver.resolve(null, ['Fotos', 'A'], signal()),
        resolver.resolve(null, ['Fotos', 'B'], signal()),
      ])

      expect(server.createFolder.mock.calls.map(([name]) => name).sort()).toEqual([
        'A',
        'B',
        'Fotos',
      ])
    })

    it('consulta el contenido de cada carpeta existente una sola vez', async () => {
      const server = fakeServer([{ id: 1, name: 'Fotos', parentId: null }])
      const resolver = new FolderResolver(server.requests)

      await Promise.all([
        resolver.resolve(null, ['Fotos', 'A'], signal()),
        resolver.resolve(null, ['Fotos', 'B'], signal()),
        resolver.resolve(null, ['Fotos', 'C'], signal()),
      ])

      // La raíz y "Fotos" (existente); las que se crean nuevas se saben vacías.
      expect(server.listSubfolders.mock.calls).toEqual([[null], [1]])
    })

    it('no pregunta por el contenido de una carpeta que acaba de crear', async () => {
      const server = fakeServer()
      const resolver = new FolderResolver(server.requests)

      await resolver.resolve(null, ['Nueva', 'Hija'], signal())

      expect(server.listSubfolders.mock.calls).toEqual([[null]])
    })
  })

  describe('fallos', () => {
    it('un fallo al crear no se memoiza: el siguiente intento lo vuelve a probar', async () => {
      const server = fakeServer()
      server.createFolder.mockRejectedValueOnce(new Error('red caída'))
      const resolver = new FolderResolver(server.requests)

      await expect(resolver.resolve(null, ['Fotos'], signal())).rejects.toThrow('red caída')
      const id = await resolver.resolve(null, ['Fotos'], signal())

      expect(id).toBeGreaterThan(0)
      expect(server.createFolder).toHaveBeenCalledTimes(2)
    })

    it('un fallo al consultar el contenido tampoco se memoiza', async () => {
      const server = fakeServer([{ id: 1, name: 'Fotos', parentId: null }])
      server.listSubfolders.mockRejectedValueOnce(new Error('timeout'))
      const resolver = new FolderResolver(server.requests)

      await expect(resolver.resolve(null, ['Fotos'], signal())).rejects.toThrow('timeout')
      expect(await resolver.resolve(null, ['Fotos'], signal())).toBe(1)
    })

    it('si falla, TODOS los que esperaban esa carpeta fallan, pero no quedan atascados', async () => {
      const server = fakeServer()
      server.createFolder.mockRejectedValueOnce(new Error('500'))
      const resolver = new FolderResolver(server.requests)

      const results = await Promise.allSettled([
        resolver.resolve(null, ['Fotos'], signal()),
        resolver.resolve(null, ['Fotos'], signal()),
      ])
      expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected'])

      await expect(resolver.resolve(null, ['Fotos'], signal())).resolves.toBeGreaterThan(0)
    })
  })

  describe('cancelación', () => {
    it('cancelar a quien llama lo suelta con un AbortError', async () => {
      const resolver = new FolderResolver({
        listSubfolders: () => new Promise(() => {}), // nunca responde
        createFolder: async () => 1,
      })
      const controller = new AbortController()

      const pending = resolver.resolve(null, ['Fotos'], controller.signal)
      controller.abort()

      await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    })

    it('con la señal ya abortada ni siquiera empieza', async () => {
      const server = fakeServer()
      const resolver = new FolderResolver(server.requests)
      const controller = new AbortController()
      controller.abort()

      await expect(resolver.resolve(null, ['Fotos'], controller.signal)).rejects.toMatchObject({
        name: 'AbortError',
      })
      expect(server.listSubfolders).not.toHaveBeenCalled()
    })

    it('cancelar a UNO no rompe la espera de los demás, y la carpeta se crea una sola vez', async () => {
      let finishCreation!: (id: number) => void
      const createFolder = vi.fn(
        () =>
          new Promise<number>((resolve) => {
            finishCreation = resolve
          }),
      )
      const resolver = new FolderResolver({ listSubfolders: async () => [], createFolder })

      const cancelled = new AbortController()
      const first = resolver.resolve(null, ['Fotos'], cancelled.signal)
      const second = resolver.resolve(null, ['Fotos'], signal())
      await tick()

      cancelled.abort()
      await expect(first).rejects.toMatchObject({ name: 'AbortError' })

      finishCreation(42)
      await expect(second).resolves.toBe(42)
      expect(createFolder).toHaveBeenCalledTimes(1)
    })
  })

  describe('clear', () => {
    it('olvida lo recordado: vuelve a consultar y fusiona con lo que ya se creó', async () => {
      const server = fakeServer()
      const resolver = new FolderResolver(server.requests)
      const first = await resolver.resolve(null, ['Fotos'], signal())

      resolver.clear()
      const second = await resolver.resolve(null, ['Fotos'], signal())

      expect(second).toBe(first) // la encuentra en el servidor en vez de crear otra
      expect(server.createFolder).toHaveBeenCalledTimes(1)
      expect(server.listSubfolders).toHaveBeenCalledTimes(2)
    })

    it('tras clear no devuelve una carpeta que el usuario borró entretanto', async () => {
      const server = fakeServer()
      const resolver = new FolderResolver(server.requests)
      const first = await resolver.resolve(null, ['Fotos'], signal())

      server.folders.splice(0, server.folders.length) // el usuario la borra
      resolver.clear()
      const second = await resolver.resolve(null, ['Fotos'], signal())

      expect(second).not.toBe(first)
      expect(server.createFolder).toHaveBeenCalledTimes(2)
    })
  })

  describe('onFolderCreated', () => {
    it('avisa con el padre de cada carpeta creada, y solo de las creadas', async () => {
      const server = fakeServer([{ id: 1, name: 'Fotos', parentId: null }])
      const onFolderCreated = vi.fn()
      const resolver = new FolderResolver(server.requests, onFolderCreated)

      await resolver.resolve(null, ['Fotos', 'Nueva', 'Hija'], signal())

      expect(onFolderCreated.mock.calls).toEqual([[1], [2]]) // bajo Fotos(1) y bajo Nueva(2); "Fotos" ya existía
    })
  })
})

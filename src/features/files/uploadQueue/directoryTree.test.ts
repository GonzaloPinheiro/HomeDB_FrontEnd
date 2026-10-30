import { describe, expect, it, vi } from 'vitest'

import type { DirectoryEntryLike, FileEntryLike } from '@/shared/lib/fileDrop'

import { readDirectoryTrees, treeFilesFromRelativePaths } from './directoryTree'

type FakeEntry = FileEntryLike | DirectoryEntryLike

function fakeFile(
  name: string,
  options: { fail?: boolean; onRead?: () => void } = {},
): FileEntryLike {
  return {
    isFile: true,
    isDirectory: false,
    name,
    file: (onSuccess, onError) => {
      options.onRead?.()
      if (options.fail) onError(new Error('no se puede leer'))
      else onSuccess(new File(['x'], name))
    },
  }
}

/** Carpeta que entrega sus entradas por tandas de `batchSize`, como Chromium (100 por llamada). */
function fakeDirectory(
  name: string,
  children: FakeEntry[],
  options: { batchSize?: number; fail?: boolean } = {},
): DirectoryEntryLike {
  const batchSize = options.batchSize ?? 100
  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader: () => {
      let offset = 0
      return {
        readEntries: (onSuccess, onError) => {
          if (options.fail) {
            onError(new Error('sin permisos'))
            return
          }
          const batch = children.slice(offset, offset + batchSize)
          offset += batchSize
          onSuccess(batch)
        },
      }
    },
  }
}

const paths = (result: Awaited<ReturnType<typeof readDirectoryTrees>>) =>
  result.files.map(({ file, dirs }) => [...dirs, file.name].join('/'))

describe('readDirectoryTrees', () => {
  it('conserva la carpeta soltada como primer segmento y recorre las subcarpetas', async () => {
    const tree = fakeDirectory('Fotos', [
      fakeFile('portada.jpg'),
      fakeDirectory('2024', [fakeFile('a.jpg'), fakeDirectory('Verano', [fakeFile('b.jpg')])]),
    ])

    const result = await readDirectoryTrees([tree])

    expect(paths(result)).toEqual([
      'Fotos/portada.jpg',
      'Fotos/2024/a.jpg',
      'Fotos/2024/Verano/b.jpg',
    ])
    expect(result.files[2].dirs).toEqual(['Fotos', '2024', 'Verano'])
    expect(result.unreadable).toBe(0)
    expect(result.exceededScanLimit).toBe(false)
  })

  it('lee todas las tandas de readEntries, no solo la primera', async () => {
    const many = Array.from({ length: 250 }, (_, i) => fakeFile(`f${i}.txt`))
    const result = await readDirectoryTrees([fakeDirectory('Muchos', many, { batchSize: 100 })])
    expect(result.files).toHaveLength(250)
  })

  it('admite varias carpetas soltadas a la vez, cada una con su raíz', async () => {
    const result = await readDirectoryTrees([
      fakeDirectory('A', [fakeFile('1.txt')]),
      fakeDirectory('B', [fakeFile('2.txt')]),
    ])
    expect(paths(result)).toEqual(['A/1.txt', 'B/2.txt'])
  })

  it('una carpeta vacía no da archivos ni error', async () => {
    const result = await readDirectoryTrees([fakeDirectory('Vacía', [fakeDirectory('Hija', [])])])
    expect(result).toEqual({ files: [], unreadable: 0, exceededScanLimit: false })
  })

  it('un archivo ilegible se cuenta y no impide leer el resto', async () => {
    const result = await readDirectoryTrees([
      fakeDirectory('D', [
        fakeFile('bien.txt'),
        fakeFile('roto.txt', { fail: true }),
        fakeFile('tambien.txt'),
      ]),
    ])
    expect(paths(result)).toEqual(['D/bien.txt', 'D/tambien.txt'])
    expect(result.unreadable).toBe(1)
  })

  it('una carpeta ilegible se cuenta y no impide leer las demás', async () => {
    const result = await readDirectoryTrees([
      fakeDirectory('D', [
        fakeDirectory('Privada', [fakeFile('x.txt')], { fail: true }),
        fakeFile('ok.txt'),
      ]),
    ])
    expect(paths(result)).toEqual(['D/ok.txt'])
    expect(result.unreadable).toBe(1)
  })

  describe('límite de lectura', () => {
    it('se rinde si una carpeta tiene más archivos que el límite, sin llegar a abrirlos', async () => {
      const onRead = vi.fn()
      const many = Array.from({ length: 11 }, (_, i) => fakeFile(`f${i}.txt`, { onRead }))

      const result = await readDirectoryTrees([fakeDirectory('Enorme', many)], 10)

      expect(result.exceededScanLimit).toBe(true)
      expect(onRead).not.toHaveBeenCalled()
    })

    it('cuenta el total entre carpetas y deja de recorrer en cuanto se supera', async () => {
      const onRead = vi.fn()
      const tree = fakeDirectory('Raíz', [
        fakeFile('1.txt', { onRead }),
        fakeFile('2.txt', { onRead }),
        fakeDirectory('A', [fakeFile('3.txt', { onRead }), fakeFile('4.txt', { onRead })]),
        fakeDirectory('B', [fakeFile('5.txt', { onRead })]),
      ])

      const result = await readDirectoryTrees([tree], 3)

      expect(result.exceededScanLimit).toBe(true)
      // 1.txt y 2.txt se leyeron; "A" ya no cabe (2 + 2 > 3) y "B" nunca se visita.
      expect(onRead).toHaveBeenCalledTimes(2)
    })

    it('justo en el límite no se rinde', async () => {
      const files = Array.from({ length: 10 }, (_, i) => fakeFile(`f${i}.txt`))
      const result = await readDirectoryTrees([fakeDirectory('Justo', files)], 10)
      expect(result.exceededScanLimit).toBe(false)
      expect(result.files).toHaveLength(10)
    })
  })
})

describe('treeFilesFromRelativePaths', () => {
  function pickedFile(name: string, relativePath: string): File {
    const file = new File(['x'], name)
    Object.defineProperty(file, 'webkitRelativePath', { value: relativePath })
    return file
  }

  it('saca las carpetas de la ruta relativa, con la elegida como primer segmento', () => {
    const [top, nested] = treeFilesFromRelativePaths([
      pickedFile('a.jpg', 'Fotos/a.jpg'),
      pickedFile('b.jpg', 'Fotos/2024/Verano/b.jpg'),
    ])
    expect(top.dirs).toEqual(['Fotos'])
    expect(nested.dirs).toEqual(['Fotos', '2024', 'Verano'])
  })

  it('sin ruta relativa (navegador que ignora webkitdirectory) los trata como sueltos', () => {
    const [loose] = treeFilesFromRelativePaths([
      pickedFile('a.jpg', ''),
      new File(['x'], 'sin-propiedad.jpg'),
    ])
    expect(loose.dirs).toEqual([])
    expect(treeFilesFromRelativePaths([new File(['x'], 'b.jpg')])[0].dirs).toEqual([])
  })
})

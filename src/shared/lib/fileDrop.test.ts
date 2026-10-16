import { describe, expect, it } from 'vitest'

import { dataTransferHasFiles, extractFiles, nameForPastedFile, type DataTransferLike } from './fileDrop'

function item(kind: string, file: File | null, isDirectory?: boolean) {
  return {
    kind,
    getAsFile: () => file,
    webkitGetAsEntry: isDirectory === undefined ? undefined : () => ({ isDirectory }),
  }
}

describe('dataTransferHasFiles', () => {
  it('reconoce un arrastre de archivos del sistema', () => {
    expect(dataTransferHasFiles({ types: ['Files'] })).toBe(true)
    expect(dataTransferHasFiles({ types: ['text/plain', 'Files'] })).toBe(true)
  })

  it('ignora texto, enlaces y arrastres sin datos', () => {
    expect(dataTransferHasFiles({ types: ['text/plain'] })).toBe(false)
    expect(dataTransferHasFiles({ types: [] })).toBe(false)
    expect(dataTransferHasFiles(null)).toBe(false)
  })
})

describe('extractFiles', () => {
  const a = new File(['a'], 'a.txt')
  const b = new File(['b'], 'b.txt')

  it('devuelve los archivos de items', () => {
    const dt: DataTransferLike = { files: [a, b], items: [item('file', a, false), item('file', b, false)] }
    expect(extractFiles(dt)).toEqual({ files: [a, b], directoryCount: 0 })
  })

  it('separa las carpetas y las cuenta', () => {
    const folder = new File([], 'carpeta')
    const dt: DataTransferLike = { files: [a, folder], items: [item('file', a, false), item('file', folder, true)] }
    expect(extractFiles(dt)).toEqual({ files: [a], directoryCount: 1 })
  })

  it('un item de texto no cuenta como archivo', () => {
    const dt: DataTransferLike = { files: [], items: [item('string', null)] }
    expect(extractFiles(dt)).toEqual({ files: [], directoryCount: 0 })
  })

  it('si el navegador no expone webkitGetAsEntry trata el item como archivo', () => {
    const dt: DataTransferLike = { files: [a], items: [item('file', a)] }
    expect(extractFiles(dt)).toEqual({ files: [a], directoryCount: 0 })
  })

  it('sin items (portapapeles de algunos navegadores) usa files', () => {
    expect(extractFiles({ files: [a, b] })).toEqual({ files: [a, b], directoryCount: 0 })
    expect(extractFiles({ files: [a], items: [] })).toEqual({ files: [a], directoryCount: 0 })
  })
})

describe('nameForPastedFile', () => {
  const now = new Date(2026, 9, 16, 14, 5, 3) // 16-oct-2026 14:05:03 hora local

  it('da nombre con fecha a las imágenes pegadas con nombre genérico y conserva tipo y contenido', () => {
    const renamed = nameForPastedFile(new File(['x'], 'image.png', { type: 'image/png' }), now)
    expect(renamed.name).toBe('Captura 2026-10-16 14.05.03.png')
    expect(renamed.type).toBe('image/png')
    expect(renamed.size).toBe(1)
  })

  it('no toca archivos con nombre propio (copiados desde el explorador del sistema)', () => {
    const file = new File(['x'], 'foto vacaciones.png')
    expect(nameForPastedFile(file, now)).toBe(file)
  })

  it('no confunde un nombre que solo empieza por "image"', () => {
    const file = new File(['x'], 'image-final.png')
    expect(nameForPastedFile(file, now)).toBe(file)
  })
})

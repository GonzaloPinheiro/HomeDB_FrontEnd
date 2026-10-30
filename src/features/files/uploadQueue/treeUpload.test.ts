import { describe, expect, it } from 'vitest'

import type { TreeFile } from './directoryTree'
import {
  MAX_FOLDER_UPLOAD_FILES,
  describeSkippedFiles,
  isValidFolderName,
  planTreeUpload,
  scanLimitMessage,
  tooManyFilesMessage,
  unreadableMessage,
} from './treeUpload'

const item = (name: string, dirs: string[] = [], size = 10): TreeFile => ({
  file: new File([new Uint8Array(size)], name),
  dirs,
})

describe('isValidFolderName', () => {
  it('acepta nombres normales, con espacios y símbolos', () => {
    expect(isValidFolderName('Fotos')).toBe(true)
    expect(isValidFolderName('Vacaciones 2024 (Italia)')).toBe(true)
    expect(isValidFolderName('a'.repeat(100))).toBe(true)
  })

  it('rechaza vacíos, solo espacios, demasiado largos y con "/"', () => {
    expect(isValidFolderName('')).toBe(false)
    expect(isValidFolderName('   ')).toBe(false)
    expect(isValidFolderName('a'.repeat(101))).toBe(false)
    expect(isValidFolderName('a/b')).toBe(false)
  })
})

describe('planTreeUpload', () => {
  it('acepta lo admitido y conserva el orden', () => {
    const a = item('a.jpg', ['Fotos'])
    const b = item('b.pdf', ['Fotos', '2024'])
    const c = item('c.txt')
    expect(planTreeUpload([a, b, c]).accepted).toEqual([a, b, c])
  })

  it('descarta los archivos de 0 bytes y los cuenta (el backend los rechaza en init)', () => {
    const plan = planTreeUpload([item('vacio.txt', ['D'], 0), item('bien.txt', ['D'])])
    expect(plan.emptyFiles).toBe(1)
    expect(plan.accepted.map((i) => i.file.name)).toEqual(['bien.txt'])
  })

  it('rechaza por extensión y guarda los nombres para el aviso', () => {
    const plan = planTreeUpload([
      item('setup.exe', ['D']),
      item('foto.jpg', ['D']),
      item('README', ['D']),
    ])
    expect(plan.rejectedExtensions).toEqual(['setup.exe', 'README'])
    expect(plan.accepted).toHaveLength(1)
  })

  describe('basura del sistema operativo', () => {
    it('dentro de una carpeta se ignora en silencio, sin contar como rechazada', () => {
      const plan = planTreeUpload([
        item('.DS_Store', ['Fotos']),
        item('Thumbs.db', ['Fotos']),
        item('desktop.ini', ['Fotos', '2024']),
        item('foto.jpg', ['Fotos']),
      ])
      expect(plan.accepted.map((i) => i.file.name)).toEqual(['foto.jpg'])
      expect(plan.rejectedExtensions).toEqual([])
      expect(describeSkippedFiles(plan)).toEqual([])
    })

    it('un archivo suelto con ese nombre sí se evalúa: lo eligió el usuario', () => {
      const plan = planTreeUpload([item('.DS_Store')])
      expect(plan.rejectedExtensions).toEqual(['.DS_Store'])
    })
  })

  describe('nombres de carpeta no válidos', () => {
    it('descarta los archivos que cuelgan de una carpeta con nombre no válido', () => {
      const largo = 'a'.repeat(101)
      const plan = planTreeUpload([
        item('uno.jpg', [largo]),
        item('dos.jpg', ['Buena', largo, 'Hija']),
        item('tres.jpg', ['Buena']),
      ])
      expect(plan.invalidFolderNameFiles).toBe(2)
      expect(plan.accepted.map((i) => i.file.name)).toEqual(['tres.jpg'])
    })

    it('el nombre de carpeta no válido se evalúa antes que el resto de motivos', () => {
      const plan = planTreeUpload([item('vacio.exe', ['  '], 0)])
      expect(plan.invalidFolderNameFiles).toBe(1)
      expect(plan.emptyFiles).toBe(0)
      expect(plan.rejectedExtensions).toEqual([])
    })
  })
})

describe('describeSkippedFiles', () => {
  it('no avisa de nada si no se descartó nada', () => {
    expect(describeSkippedFiles(planTreeUpload([item('a.jpg', ['D'])]))).toEqual([])
  })

  it('da un aviso por motivo, con el singular y el plural correctos', () => {
    const one = describeSkippedFiles(
      planTreeUpload([item('x.exe', ['D']), item('v.txt', ['D'], 0)]),
    )
    expect(one).toEqual([
      '"x.exe": tipo de archivo no admitido',
      '1 archivo vacío omitido: el servidor no admite archivos de 0 bytes',
    ])

    const many = describeSkippedFiles(
      planTreeUpload([
        item('v1.txt', ['D'], 0),
        item('v2.txt', ['D'], 0),
        item('a.jpg', ['x'.repeat(101)]),
      ]),
    )
    expect(many).toEqual([
      '2 archivos vacíos omitidos: el servidor no admite archivos de 0 bytes',
      '1 archivo omitido: está en una carpeta con nombre vacío o de más de 100 caracteres',
    ])
  })
})

describe('mensajes de límite', () => {
  it('el de demasiados archivos da el total real y el máximo con separador de miles', () => {
    expect(tooManyFilesMessage(1284)).toBe(
      `La carpeta tiene 1.284 archivos para subir y el máximo por subida es ${MAX_FOLDER_UPLOAD_FILES}. Súbela por partes.`,
    )
  })

  it('el de lectura da el tope de lectura', () => {
    expect(scanLimitMessage()).toContain('5.000')
  })

  it('el de ilegibles concuerda en número', () => {
    expect(unreadableMessage(1)).toBe('1 elemento no se pudo leer y se ha omitido')
    expect(unreadableMessage(3)).toBe('3 elementos no se pudieron leer y se han omitido')
  })
})

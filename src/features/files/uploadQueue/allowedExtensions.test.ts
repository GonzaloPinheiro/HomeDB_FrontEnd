import { describe, expect, it } from 'vitest'

import { getExtension, isAllowedExtension, rejectedExtensionsMessage } from './allowedExtensions'

describe('getExtension', () => {
  it('devuelve la última extensión en minúsculas', () => {
    expect(getExtension('Foto.JPG')).toBe('.jpg')
    expect(getExtension('backup.tar.gz')).toBe('.gz')
  })

  it('devuelve cadena vacía sin extensión', () => {
    expect(getExtension('Makefile')).toBe('')
    expect(getExtension('termina-en-punto.')).toBe('')
  })
})

it('coincide con Path.GetExtension: un nombre que es solo la extensión la conserva', () => {
  expect(getExtension('.png')).toBe('.png')
  expect(getExtension('.gitignore')).toBe('.gitignore')
})

describe('isAllowedExtension', () => {
  it('acepta las de la lista blanca sin distinguir mayúsculas', () => {
    expect(isAllowedExtension('informe.PDF')).toBe(true)
    expect(isAllowedExtension('video.mp4')).toBe(true)
    expect(isAllowedExtension('config.yml')).toBe(true)
  })

  it('rechaza las no admitidas y los archivos sin extensión', () => {
    expect(isAllowedExtension('instalador.exe')).toBe(false)
    expect(isAllowedExtension('imagen.iso')).toBe(false)
    expect(isAllowedExtension('README')).toBe(false)
  })
})

describe('rejectedExtensionsMessage', () => {
  it('no hay mensaje si no se rechazó nada', () => {
    expect(rejectedExtensionsMessage([])).toBeNull()
  })

  it('con uno solo nombra el archivo', () => {
    expect(rejectedExtensionsMessage(['setup.exe'])).toBe('"setup.exe": tipo de archivo no admitido')
  })

  it('indica "(sin extensión)" cuando ese es el motivo', () => {
    expect(rejectedExtensionsMessage(['README'])).toBe('"README" (sin extensión): tipo de archivo no admitido')
  })

  it('con varios cuenta el total y nombra solo los tres primeros', () => {
    expect(rejectedExtensionsMessage(['a.exe', 'b.iso', 'c.dll', 'd.bin', 'e.msi'])).toBe(
      '5 archivos con tipo no admitido: "a.exe", "b.iso", "c.dll" y 2 más',
    )
  })

  it('con tres exactos no añade el "y N más"', () => {
    expect(rejectedExtensionsMessage(['a.exe', 'b.iso', 'c.dll'])).toBe(
      '3 archivos con tipo no admitido: "a.exe", "b.iso", "c.dll"',
    )
  })
})

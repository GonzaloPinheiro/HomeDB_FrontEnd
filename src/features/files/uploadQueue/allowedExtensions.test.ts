import { describe, expect, it } from 'vitest'

import { getExtension, isAllowedExtension } from './allowedExtensions'

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

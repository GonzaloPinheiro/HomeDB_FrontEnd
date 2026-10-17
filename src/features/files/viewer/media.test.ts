import { describe, expect, it } from 'vitest'

import type { ExplorerItem } from '../types'
import { clampSeek, getMediaKind, isViewableFile, streamUrl } from './media'

const file = (contentType: string): ExplorerItem => ({
  kind: 'file',
  id: 1,
  name: 'x',
  createdAt: '2026-01-01T00:00:00Z',
  sizeBytes: 1,
  contentType,
  folderId: null,
})

describe('getMediaKind', () => {
  it('imágenes y vídeos tienen visor; todo lo demás no', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/gif', 'image/webp']) expect(getMediaKind(type)).toBe('image')
    for (const type of ['video/mp4', 'video/quicktime']) expect(getMediaKind(type)).toBe('video')
    for (const type of ['audio/mpeg', 'application/pdf', 'text/plain', 'application/zip', 'application/json', '']) {
      expect(getMediaKind(type)).toBeNull()
    }
  })
})

describe('isViewableFile', () => {
  it('solo archivos de imagen/vídeo; una carpeta nunca', () => {
    expect(isViewableFile(file('image/png'))).toBe(true)
    expect(isViewableFile(file('video/mp4'))).toBe(true)
    expect(isViewableFile(file('application/pdf'))).toBe(false)
    expect(isViewableFile({ kind: 'folder', id: 1, name: 'f', createdAt: '', parentFolderId: null })).toBe(false)
  })
})

describe('streamUrl', () => {
  it('apunta al endpoint de streaming de la API configurada', () => {
    expect(streamUrl(42)).toBe('http://localhost:5000/api/files/42/stream')
  })
})

describe('clampSeek', () => {
  it('salta hacia delante y hacia atrás', () => {
    expect(clampSeek(30, 10, 120)).toBe(40)
    expect(clampSeek(30, -10, 120)).toBe(20)
  })

  it('no baja de 0 ni pasa de la duración', () => {
    expect(clampSeek(4, -10, 120)).toBe(0)
    expect(clampSeek(115, 10, 120)).toBe(120)
    expect(clampSeek(120, 10, 120)).toBe(120)
  })

  it('con duración desconocida (NaN o Infinity) solo acota por abajo', () => {
    expect(clampSeek(30, 10, NaN)).toBe(40)
    expect(clampSeek(30, 10, Infinity)).toBe(40)
    expect(clampSeek(3, -10, NaN)).toBe(0)
  })
})

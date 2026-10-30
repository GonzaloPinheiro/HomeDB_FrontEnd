import { describe, expect, it } from 'vitest'

import {
  countByCategory,
  formatEta,
  formatRatio,
  getDownloadSelection,
  getFileKind,
  getProgressCaption,
  getProgressView,
} from './presentation'
import type { Torrent, TorrentFile } from './types'

const BASE: Torrent = {
  id: 1,
  name: 'Ejemplo',
  category: 'movies',
  status: 'downloading',
  sizeBytes: 1024,
  fileCount: 1,
  progressPercent: null,
  downloadBytesPerSec: null,
  etaSeconds: null,
  queuePosition: null,
  pausedAt: null,
  ratio: null,
  ratioTarget: null,
  errorMessage: null,
  pendingImport: null,
  addedAt: '2026-10-30T10:00:00Z',
}

const torrent = (overrides: Partial<Torrent>): Torrent => ({ ...BASE, ...overrides })

describe('getProgressView', () => {
  it('descargando: acento y porcentaje redondeado', () => {
    expect(getProgressView(torrent({ status: 'downloading', progressPercent: 62.6 }))).toEqual({
      value: 62.6,
      label: '63 %',
      tone: 'accent',
    })
  })

  it('acota el porcentaje a 0-100', () => {
    expect(getProgressView(torrent({ status: 'downloading', progressPercent: 140 })).value).toBe(100)
    expect(getProgressView(torrent({ status: 'downloading', progressPercent: -5 })).value).toBe(0)
  })

  it('en cola y contenido borrado: sin valor que pintar', () => {
    expect(getProgressView(torrent({ status: 'queued' }))).toEqual({ value: null, label: '—', tone: 'neutral' })
    expect(getProgressView(torrent({ status: 'contentDeleted' }))).toEqual({
      value: null,
      label: '—',
      tone: 'neutral',
    })
  })

  it('pausado conserva el porcentaje en tono neutro; error en tono crítico', () => {
    expect(getProgressView(torrent({ status: 'paused', progressPercent: 28 }))).toMatchObject({ label: '28 %', tone: 'neutral' })
    expect(getProgressView(torrent({ status: 'error', progressPercent: 47 }))).toMatchObject({ label: '47 %', tone: 'critical' })
  })

  it('completado: siempre 100 %', () => {
    expect(getProgressView(torrent({ status: 'completed', progressPercent: null }))).toEqual({
      value: 100,
      label: '100 %',
      tone: 'positive',
    })
  })

  it('sembrando: la cifra es el ratio y la barra mide el avance hacia el objetivo', () => {
    expect(getProgressView(torrent({ status: 'seeding', ratio: 1.4, ratioTarget: 2 }))).toEqual({
      value: 70,
      label: '1,4',
      tone: 'positive',
    })
  })

  it('sembrando: sin objetivo la barra va llena; sin ratio, vacía', () => {
    expect(getProgressView(torrent({ status: 'seeding', ratio: 0.5, ratioTarget: null })).value).toBe(100)
    expect(getProgressView(torrent({ status: 'seeding', ratio: null })).value).toBeNull()
  })

  it('sembrando: no pasa de 100 aunque se supere el objetivo', () => {
    expect(getProgressView(torrent({ status: 'seeding', ratio: 3, ratioTarget: 2 })).value).toBe(100)
  })
})

describe('getProgressCaption', () => {
  it('descargando: velocidad y tiempo restante', () => {
    const text = getProgressCaption(
      torrent({ status: 'downloading', downloadBytesPerSec: 12 * 1024 * 1024, etaSeconds: 360 }),
    )
    expect(text).toBe('↓ 12 MB/s · 6 min')
  })

  it('descargando sin datos de velocidad: texto de respaldo', () => {
    expect(getProgressCaption(torrent({ status: 'downloading' }))).toBe('Descargando')
  })

  it('en cola: posición', () => {
    expect(getProgressCaption(torrent({ status: 'queued', queuePosition: 2 }))).toBe('Posición 2 en cola')
  })

  it('pausado: hora de la pausa, o solo "por ti" si no se conoce', () => {
    expect(getProgressCaption(torrent({ status: 'paused', pausedAt: '2026-10-30T17:02:00Z' }))).toMatch(
      /^Pausado por ti · \d{2}:\d{2}$/,
    )
    expect(getProgressCaption(torrent({ status: 'paused' }))).toBe('Pausado por ti')
  })

  it('sembrando: ratio frente al objetivo', () => {
    expect(getProgressCaption(torrent({ status: 'seeding', ratio: 1.4, ratioTarget: 2 }))).toBe('Ratio 1,4 de 2,0')
    expect(getProgressCaption(torrent({ status: 'seeding', ratio: 1.4 }))).toBe('Ratio 1,4')
  })

  it('error: la causa tal cual, o un texto genérico', () => {
    expect(getProgressCaption(torrent({ status: 'error', errorMessage: 'Disco sin espacio' }))).toBe('Disco sin espacio')
    expect(getProgressCaption(torrent({ status: 'error' }))).toBe('Error desconocido')
  })

  it('completado y contenido borrado', () => {
    expect(getProgressCaption(torrent({ status: 'completed' }))).toBe('Siembra finalizada')
    expect(getProgressCaption(torrent({ status: 'contentDeleted' }))).toBe('Solo torrent guardado')
  })
})

describe('formatEta', () => {
  it('menos de un minuto', () => {
    expect(formatEta(30)).toBe('< 1 min')
  })

  it('minutos, redondeando hacia arriba', () => {
    expect(formatEta(360)).toBe('6 min')
    expect(formatEta(61)).toBe('2 min')
  })

  it('horas y minutos', () => {
    expect(formatEta(3600)).toBe('1 h 00 min')
    expect(formatEta(3600 + 5 * 60)).toBe('1 h 05 min')
  })

  it('valores inválidos', () => {
    expect(formatEta(-1)).toBe('—')
    expect(formatEta(Number.NaN)).toBe('—')
  })
})

describe('formatRatio', () => {
  it('un decimal con coma', () => {
    expect(formatRatio(1.4)).toBe('1,4')
    expect(formatRatio(2)).toBe('2,0')
  })
})

describe('countByCategory', () => {
  it('cuenta por categoría e incluye las vacías con 0', () => {
    const counts = countByCategory([
      torrent({ id: 1, category: 'movies' }),
      torrent({ id: 2, category: 'series' }),
      torrent({ id: 3, category: 'series' }),
    ])
    expect(counts).toEqual({ movies: 1, series: 2, music: 0, books: 0, software: 0 })
  })
})

describe('getFileKind', () => {
  it('por extensión, sin distinguir mayúsculas', () => {
    expect(getFileKind('pelicula.MKV')).toBe('video')
    expect(getFileKind('es.srt')).toBe('subtitle')
    expect(getFileKind('01 - Pista.flac')).toBe('audio')
    expect(getFileKind('cover.jpg')).toBe('image')
    expect(getFileKind('release.nfo')).toBe('document')
    expect(getFileKind('distro.iso')).toBe('archive')
  })

  it('sin extensión o desconocida: other', () => {
    expect(getFileKind('LEEME')).toBe('other')
    expect(getFileKind('datos.xyz')).toBe('other')
  })

  it('usa la última extensión', () => {
    expect(getFileKind('archivo.tar.zip')).toBe('archive')
  })
})

describe('getDownloadSelection', () => {
  const file = (id: number, sizeBytes: number, role: TorrentFile['role']): TorrentFile => ({
    id,
    name: `f${id}`,
    sizeBytes,
    role,
    language: null,
  })

  it('excluye de lo seleccionado solo los ficheros marcados "No descargar"', () => {
    expect(getDownloadSelection([file(1, 100, 'mainVideo'), file(2, 10, 'extra'), file(3, 50, 'skip')])).toEqual({
      selectedBytes: 110,
      totalBytes: 160,
    })
  })

  it('los ficheros sin rol (no es vídeo) cuentan como seleccionados', () => {
    expect(getDownloadSelection([file(1, 100, null), file(2, 20, null)])).toEqual({
      selectedBytes: 120,
      totalBytes: 120,
    })
  })

  it('lista vacía', () => {
    expect(getDownloadSelection([])).toEqual({ selectedBytes: 0, totalBytes: 0 })
  })
})

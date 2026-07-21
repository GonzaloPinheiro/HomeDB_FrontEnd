import { describe, expect, it } from 'vitest'

import { sortExplorerItems, type SortDirection, type SortKey } from './sort'
import type { ExplorerItem } from './types'

function folder(name: string, createdAt: string): ExplorerItem {
  return { kind: 'folder', id: name.length, name, createdAt, parentFolderId: null }
}

function file(name: string, sizeBytes: number, createdAt: string): ExplorerItem {
  return { kind: 'file', id: sizeBytes, name, createdAt, sizeBytes, contentType: 'x', folderId: null }
}

const ITEMS: ExplorerItem[] = [
  file('zeta.txt', 300, '2026-01-03T00:00:00Z'),
  folder('Fotos', '2026-02-01T00:00:00Z'),
  file('alfa.txt', 100, '2026-01-01T00:00:00Z'),
  folder('Docs', '2026-03-01T00:00:00Z'),
  file('medio.txt', 200, '2026-01-02T00:00:00Z'),
]

const ALL_COMBINATIONS: Array<[SortKey, SortDirection]> = [
  ['name', 'asc'],
  ['name', 'desc'],
  ['size', 'asc'],
  ['size', 'desc'],
  ['date', 'asc'],
  ['date', 'desc'],
]

describe('sortExplorerItems (CLAUDE.md §6.3)', () => {
  it('las carpetas van SIEMPRE primero, con cualquier criterio y dirección', () => {
    for (const [key, direction] of ALL_COMBINATIONS) {
      const sorted = sortExplorerItems(ITEMS, key, direction)
      expect(sorted.slice(0, 2).every((item) => item.kind === 'folder')).toBe(true)
      expect(sorted.slice(2).every((item) => item.kind === 'file')).toBe(true)
    }
  })

  it('nombre asc/desc invierte archivos y carpetas', () => {
    const asc = sortExplorerItems(ITEMS, 'name', 'asc')
    expect(asc.map((i) => i.name)).toEqual(['Docs', 'Fotos', 'alfa.txt', 'medio.txt', 'zeta.txt'])
    const desc = sortExplorerItems(ITEMS, 'name', 'desc')
    expect(desc.map((i) => i.name)).toEqual(['Fotos', 'Docs', 'zeta.txt', 'medio.txt', 'alfa.txt'])
  })

  it('tamaño reordena solo los archivos: las carpetas quedan por nombre fijo', () => {
    const desc = sortExplorerItems(ITEMS, 'size', 'desc')
    // Carpetas por nombre ascendente aunque la dirección sea desc
    expect(desc.slice(0, 2).map((i) => i.name)).toEqual(['Docs', 'Fotos'])
    expect(desc.slice(2).map((i) => i.name)).toEqual(['zeta.txt', 'medio.txt', 'alfa.txt'])
  })

  it('fecha ordena todo, con inversión', () => {
    const asc = sortExplorerItems(ITEMS, 'date', 'asc')
    expect(asc.map((i) => i.name)).toEqual(['Fotos', 'Docs', 'alfa.txt', 'medio.txt', 'zeta.txt'])
    const desc = sortExplorerItems(ITEMS, 'date', 'desc')
    expect(desc.map((i) => i.name)).toEqual(['Docs', 'Fotos', 'zeta.txt', 'medio.txt', 'alfa.txt'])
  })
})

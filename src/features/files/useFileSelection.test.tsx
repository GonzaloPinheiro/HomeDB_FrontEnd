import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { ExplorerItem } from './types'
import { useFileSelection } from './useFileSelection'

const file = (id: number): ExplorerItem => ({
  kind: 'file',
  id,
  name: `f${id}.txt`,
  createdAt: '2026-01-01T00:00:00Z',
  sizeBytes: 1,
  contentType: 'text/plain',
  folderId: null,
})
const folder = (id: number): ExplorerItem => ({ kind: 'folder', id, name: `d${id}`, createdAt: '2026-01-01T00:00:00Z', parentFolderId: null })

const items = [folder(1), file(1), file(2), file(3)]

describe('useFileSelection', () => {
  it('alterna elementos y distingue archivo/carpeta con el mismo id', () => {
    const { result } = renderHook(() => useFileSelection(null, items))
    act(() => result.current.toggle(items[0]))
    expect(result.current.isSelected(items[0])).toBe(true)
    expect(result.current.isSelected(items[1])).toBe(false) // file 1, no la carpeta 1
    expect(result.current.count).toBe(1)
  })

  it('Shift+clic selecciona el rango desde el último marcado, en el orden visible', () => {
    const { result } = renderHook(() => useFileSelection(null, items))
    act(() => result.current.select(items[1], { shift: false }))
    act(() => result.current.select(items[3], { shift: true }))
    expect(result.current.selectedItems.map((i) => i.name)).toEqual(['f1.txt', 'f2.txt', 'f3.txt'])
  })

  it('seleccionar todo y la casilla de cabecera (todo / nada)', () => {
    const { result } = renderHook(() => useFileSelection(null, items))
    act(() => result.current.toggleAll())
    expect(result.current.allSelected).toBe(true)
    expect(result.current.count).toBe(4)
    act(() => result.current.toggleAll())
    expect(result.current.count).toBe(0)
  })

  it('al cambiar de carpeta la selección desaparece', () => {
    const { result, rerender } = renderHook(({ folderId }) => useFileSelection(folderId, items), {
      initialProps: { folderId: null as number | null },
    })
    act(() => result.current.selectAll())
    expect(result.current.count).toBe(4)
    rerender({ folderId: 7 })
    expect(result.current.count).toBe(0)
    // y al volver no resucita
    rerender({ folderId: null })
    expect(result.current.count).toBe(0)
  })

  it('solo cuenta lo visible: un elemento que desaparece de la lista deja de estar seleccionado', () => {
    const { result, rerender } = renderHook(({ list }) => useFileSelection(null, list), {
      initialProps: { list: items },
    })
    act(() => result.current.selectAll())
    rerender({ list: items.filter((i) => i.name !== 'f2.txt') }) // p. ej. lo filtra el buscador o se ha borrado
    expect(result.current.selectedItems.map((i) => i.name)).toEqual(['d1', 'f1.txt', 'f3.txt'])
    expect(result.current.allSelected).toBe(true)
  })

  it('clear vacía la selección', () => {
    const { result } = renderHook(() => useFileSelection(null, items))
    act(() => result.current.selectAll())
    act(() => result.current.clear())
    expect(result.current.count).toBe(0)
  })
})

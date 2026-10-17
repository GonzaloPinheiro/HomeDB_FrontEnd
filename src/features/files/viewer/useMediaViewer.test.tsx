import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { ExplorerItem } from '../types'
import { useMediaViewer } from './useMediaViewer'

const file = (id: number, contentType: string): ExplorerItem => ({
  kind: 'file',
  id,
  name: `f${id}`,
  createdAt: '2026-01-01T00:00:00Z',
  sizeBytes: 1,
  contentType,
  folderId: null,
})
const folder: ExplorerItem = { kind: 'folder', id: 1, name: 'd', createdAt: '', parentFolderId: null }

// Orden visible: carpeta, imagen 1, pdf 2, vídeo 3, imagen 4
const visible = [folder, file(1, 'image/png'), file(2, 'application/pdf'), file(3, 'video/mp4'), file(4, 'image/jpeg')]

describe('useMediaViewer', () => {
  it('arranca cerrado y solo recorre imágenes y vídeos, en el orden visible', () => {
    const { result } = renderHook(() => useMediaViewer(visible))
    expect(result.current.isOpen).toBe(false)
    expect(result.current.items.map((item) => item.id)).toEqual([1, 3, 4])
  })

  it('abrir un archivo da su posición entre los visualizables (el pdf no cuenta)', () => {
    const { result } = renderHook(() => useMediaViewer(visible))
    act(() => result.current.open(visible[3])) // vídeo 3
    expect(result.current.isOpen).toBe(true)
    expect(result.current.index).toBe(1)
  })

  it('goTo pasa al anterior/siguiente; fuera de rango no hace nada', () => {
    const { result } = renderHook(() => useMediaViewer(visible))
    act(() => result.current.open(visible[1]))
    act(() => result.current.goTo(2))
    expect(result.current.items[result.current.index].id).toBe(4)
    act(() => result.current.goTo(3))
    act(() => result.current.goTo(-1))
    expect(result.current.items[result.current.index].id).toBe(4)
  })

  it('close lo cierra', () => {
    const { result } = renderHook(() => useMediaViewer(visible))
    act(() => result.current.open(visible[1]))
    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)
  })

  it('si el archivo abierto desaparece de la lista se cierra, y no reabre solo si reaparece', () => {
    const { result, rerender } = renderHook(({ items }) => useMediaViewer(items), { initialProps: { items: visible } })
    act(() => result.current.open(visible[3]))
    expect(result.current.isOpen).toBe(true)

    rerender({ items: visible.filter((item) => item.id !== 3) }) // se borró desde otra pestaña
    expect(result.current.isOpen).toBe(false)

    rerender({ items: visible }) // un refetch lo trae de vuelta
    expect(result.current.isOpen).toBe(false)
  })

  it('un filtro de búsqueda que oculta lo abierto cierra el visor', () => {
    const { result, rerender } = renderHook(({ items }) => useMediaViewer(items), { initialProps: { items: visible } })
    act(() => result.current.open(visible[1]))
    rerender({ items: [visible[3]] })
    expect(result.current.isOpen).toBe(false)
  })
})

import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { parseTorrentId, useSelectedTorrent } from './useSelectedTorrent'

describe('parseTorrentId', () => {
  it('id entero positivo', () => {
    expect(parseTorrentId('3')).toBe(3)
  })

  it.each([null, '', '0', '-2', '1.5', 'abc', '3abc', ' 3'])('%j no es un id', (raw) => {
    expect(parseTorrentId(raw)).toBeNull()
  })
})

function renderSelection(initialEntry: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
  )
  return renderHook(
    () => ({ selection: useSelectedTorrent(), location: useLocation(), navigate: useNavigate() }),
    { wrapper },
  )
}

describe('useSelectedTorrent', () => {
  it('lee el torrent abierto de la URL', () => {
    const { result } = renderSelection('/torrents?torrent=4')
    expect(result.current.selection.selectedId).toBe(4)
  })

  it('sin parámetro no hay selección', () => {
    const { result } = renderSelection('/torrents')
    expect(result.current.selection.selectedId).toBeNull()
  })

  it('select escribe el parámetro y conserva los demás', () => {
    const { result } = renderSelection('/torrents?otro=1')
    act(() => result.current.selection.select(2))
    expect(result.current.location.search).toBe('?otro=1&torrent=2')
    expect(result.current.selection.selectedId).toBe(2)
  })

  it('clear quita solo el parámetro del torrent', () => {
    const { result } = renderSelection('/torrents?otro=1&torrent=2')
    act(() => result.current.selection.clear())
    expect(result.current.location.search).toBe('?otro=1')
    expect(result.current.selection.selectedId).toBeNull()
  })

  it('abrir el primero apila una entrada de historial; cambiar de torrent la sustituye', () => {
    const { result } = renderSelection('/torrents')

    act(() => result.current.selection.select(1))
    act(() => result.current.selection.select(2))
    expect(result.current.selection.selectedId).toBe(2)

    // «Atrás» desde el torrent 2 debe llevar a la lista, no al torrent 1
    act(() => result.current.navigate(-1))
    expect(result.current.selection.selectedId).toBeNull()
    expect(result.current.location.search).toBe('')
  })

  it('cerrar sustituye la entrada: no deja una entrada duplicada de la lista', () => {
    const { result } = renderSelection('/torrents')

    act(() => result.current.selection.select(1))
    act(() => result.current.selection.clear())
    expect(result.current.selection.selectedId).toBeNull()

    // Atrás sale de la lista (no hay entrada anterior): se queda donde está
    act(() => result.current.navigate(-1))
    expect(result.current.location.pathname).toBe('/torrents')
  })
})

import { DndContext } from '@dnd-kit/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ExplorerItem } from './types'
import { useExplorerItemInteraction } from './useExplorerItemInteraction'

const folder: ExplorerItem = { kind: 'folder', id: 1, name: 'Fotos', createdAt: '2026-01-01T00:00:00Z', parentFolderId: null }
const file: ExplorerItem = {
  kind: 'file',
  id: 7,
  name: 'a.png',
  createdAt: '2026-01-01T00:00:00Z',
  sizeBytes: 1,
  contentType: 'image/png',
  folderId: null,
}

const movie: ExplorerItem = { ...(file as Extract<ExplorerItem, { kind: 'file' }>), id: 8, name: 'v.mp4', contentType: 'video/mp4' }
const document: ExplorerItem = { ...(file as Extract<ExplorerItem, { kind: 'file' }>), id: 9, name: 'a.pdf', contentType: 'application/pdf' }

// Banco de pruebas mínimo: un elemento con un control hijo (como la casilla o el
// menú de acciones) para comprobar qué eventos cuentan como "del elemento".
function Harness({
  item,
  onEnterFolder,
  onOpen,
  onSelect,
}: {
  item: ExplorerItem
  onEnterFolder: () => void
  onOpen: () => void
  onSelect: () => void
}) {
  const { rowProps } = useExplorerItemInteraction({ item, onEnterFolder, onOpen, onSelect })
  return (
    <div {...rowProps} data-testid="item">
      <button type="button">hijo</button>
    </div>
  )
}

function setup(item: ExplorerItem) {
  const onEnterFolder = vi.fn()
  const onOpen = vi.fn()
  const onSelect = vi.fn()
  render(
    <DndContext>
      <Harness item={item} onEnterFolder={onEnterFolder} onOpen={onOpen} onSelect={onSelect} />
    </DndContext>,
  )
  return { onEnterFolder, onOpen, onSelect, element: screen.getByTestId('item') }
}

describe('useExplorerItemInteraction', () => {
  // Sin globals de vitest, Testing Library no limpia el DOM entre pruebas
  afterEach(cleanup)

  it('clic en una carpeta entra', () => {
    const { element, onEnterFolder } = setup(folder)
    fireEvent.click(element)
    expect(onEnterFolder).toHaveBeenCalledWith(folder)
  })

  it('clic en una carpeta no abre el visor', () => {
    const { element, onOpen } = setup(folder)
    fireEvent.click(element)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('clic en una imagen o un vídeo abre el visor, sin entrar ni seleccionar', () => {
    const image = setup(file)
    fireEvent.click(image.element)
    expect(image.onOpen).toHaveBeenCalledWith(file)
    expect(image.onEnterFolder).not.toHaveBeenCalled()
    expect(image.onSelect).not.toHaveBeenCalled()
    cleanup()

    const video = setup(movie)
    fireEvent.click(video.element)
    expect(video.onOpen).toHaveBeenCalledWith(movie)
  })

  it('clic en un archivo que no es imagen ni vídeo no hace nada', () => {
    const { element, onOpen, onEnterFolder, onSelect } = setup(document)
    fireEvent.click(element)
    fireEvent.keyDown(element, { key: 'Enter' })
    expect(onOpen).not.toHaveBeenCalled()
    expect(onEnterFolder).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('Ctrl/Shift+clic sobre una imagen selecciona en vez de abrir el visor', () => {
    const { element, onOpen, onSelect } = setup(file)
    fireEvent.click(element, { ctrlKey: true })
    fireEvent.click(element, { shiftKey: true })
    expect(onSelect).toHaveBeenCalledTimes(2)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('Enter y Espacio sobre una imagen enfocada abren el visor; en un control hijo, no', () => {
    const { element, onOpen } = setup(file)
    fireEvent.keyDown(element, { key: 'Enter' })
    fireEvent.keyDown(element, { key: ' ' })
    expect(onOpen).toHaveBeenCalledTimes(2)
    fireEvent.keyDown(element.querySelector('button')!, { key: 'Enter' })
    expect(onOpen).toHaveBeenCalledTimes(2)
  })

  it('Ctrl/Cmd+clic y Shift+clic seleccionan en vez de entrar en la carpeta', () => {
    const { element, onEnterFolder, onSelect } = setup(folder)
    fireEvent.click(element, { ctrlKey: true })
    expect(onSelect).toHaveBeenLastCalledWith(folder, { shift: false })
    fireEvent.click(element, { metaKey: true })
    expect(onSelect).toHaveBeenLastCalledWith(folder, { shift: false })
    fireEvent.click(element, { shiftKey: true })
    expect(onSelect).toHaveBeenLastCalledWith(folder, { shift: true })
    expect(onEnterFolder).not.toHaveBeenCalled()
  })

  it('Enter y Espacio sobre la carpeta enfocada entran', () => {
    const { element, onEnterFolder } = setup(folder)
    fireEvent.keyDown(element, { key: 'Enter' })
    fireEvent.keyDown(element, { key: ' ' })
    expect(onEnterFolder).toHaveBeenCalledTimes(2)
  })

  it('Enter/Espacio en un control hijo (casilla, menú) NO entran en la carpeta', () => {
    const { element, onEnterFolder } = setup(folder)
    const child = element.querySelector('button')!
    fireEvent.keyDown(child, { key: 'Enter' })
    fireEvent.keyDown(child, { key: ' ' })
    expect(onEnterFolder).not.toHaveBeenCalled()
  })

  it('una carpeta es un botón focuable, sin los atributos de arrastre', () => {
    const { element } = setup(folder)
    expect(element.getAttribute('role')).toBe('button')
    expect(element.getAttribute('tabindex')).toBe('0')
    expect(element.getAttribute('aria-roledescription')).toBeNull()
  })

  it('un archivo conserva los atributos de arrastre de dnd-kit', () => {
    const { element } = setup(file)
    expect(element.getAttribute('aria-roledescription')).toBe('draggable')
  })
})

import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useFileDropZone } from './useFileDropZone'

const file = (name: string) => new File(['x'], name)

/** Entrada de carpeta de mentira: el hook solo la reenvía, no la lee. */
const directory = (name: string) => ({
  isFile: false,
  isDirectory: true,
  name,
  createReader: () => ({ readEntries: (onSuccess: (entries: never[]) => void) => onSuccess([]) }),
})

/** Doble mínimo de DataTransfer: lo que el hook lee (types, files, items). */
function transfer(files: File[], options: { directories?: ReturnType<typeof directory>[]; types?: string[] } = {}) {
  const items = [
    ...files.map((f) => ({
      kind: 'file',
      getAsFile: () => f,
      webkitGetAsEntry: () => ({ isFile: true, isDirectory: false, name: f.name }),
    })),
    ...(options.directories ?? []).map((entry) => ({
      kind: 'file',
      getAsFile: () => new File([], entry.name),
      webkitGetAsEntry: () => entry,
    })),
  ]
  return { types: options.types ?? ['Files'], files, items, dropEffect: 'none' }
}

/** Dispara un evento nativo sobre `target` con `dataTransfer` (jsdom no trae DragEvent/ClipboardEvent). */
function fire(target: EventTarget, type: string, dataTransfer?: unknown): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  if (dataTransfer) Object.defineProperty(event, type === 'paste' ? 'clipboardData' : 'dataTransfer', { value: dataTransfer })
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}

// Sin globals de Vitest, RTL no desmonta solo: los listeners de document de un test se acumularían en el siguiente.
afterEach(cleanup)

describe('useFileDropZone — scope window', () => {
  it('resalta mientras se arrastran archivos y se apaga al salir (con hijos de por medio)', () => {
    const { result } = renderHook(() => useFileDropZone({ scope: 'window', onDrop: vi.fn() }))
    const dt = transfer([file('a.txt')])

    fire(document.body, 'dragenter', dt)
    expect(result.current.isDragging).toBe(true)
    fire(document.body, 'dragenter', dt) // entra en un hijo
    fire(document.body, 'dragleave', dt) // sale del padre: sigue dentro
    expect(result.current.isDragging).toBe(true)
    fire(document.body, 'dragleave', dt)
    expect(result.current.isDragging).toBe(false)
  })

  it('ignora arrastres sin archivos (texto, enlaces)', () => {
    const { result } = renderHook(() => useFileDropZone({ scope: 'window', onDrop: vi.fn() }))
    fire(document.body, 'dragenter', transfer([], { types: ['text/plain'] }))
    expect(result.current.isDragging).toBe(false)
  })

  it('al soltar entrega los archivos, apaga el resaltado y permite el drop', () => {
    const onDrop = vi.fn()
    const { result } = renderHook(() => useFileDropZone({ scope: 'window', onDrop }))
    const a = file('a.txt')
    const dt = transfer([a])

    fire(document.body, 'dragenter', dt)
    const over = fire(document.body, 'dragover', dt)
    expect(over.defaultPrevented).toBe(true)
    expect(dt.dropEffect).toBe('copy')
    const drop = fire(document.body, 'drop', dt)

    expect(drop.defaultPrevented).toBe(true)
    expect(onDrop).toHaveBeenCalledWith({ files: [a], directories: [] })
    expect(result.current.isDragging).toBe(false)
  })

  it('entrega las carpetas aparte de los archivos, sin tratarlas como archivos', () => {
    const onDrop = vi.fn()
    renderHook(() => useFileDropZone({ scope: 'window', onDrop }))
    const a = file('a.txt')
    const fotos = directory('Fotos')
    const docs = directory('Docs')
    fire(document.body, 'drop', transfer([a], { directories: [fotos, docs] }))

    expect(onDrop).toHaveBeenCalledTimes(1)
    expect(onDrop).toHaveBeenCalledWith({ files: [a], directories: [fotos, docs] })
  })

  it('solo carpetas: también las entrega', () => {
    const onDrop = vi.fn()
    renderHook(() => useFileDropZone({ scope: 'window', onDrop }))
    const fotos = directory('Fotos')
    fire(document.body, 'drop', transfer([], { directories: [fotos] }))
    expect(onDrop).toHaveBeenCalledWith({ files: [], directories: [fotos] })
  })

  it('desactivado no escucha nada', () => {
    const onDrop = vi.fn()
    const { result } = renderHook(() => useFileDropZone({ scope: 'window', enabled: false, onDrop }))
    fire(document.body, 'dragenter', transfer([file('a.txt')]))
    fire(document.body, 'drop', transfer([file('a.txt')]))
    expect(result.current.isDragging).toBe(false)
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('usa siempre el onDrop más reciente sin reengancharse', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ cb }) => useFileDropZone({ scope: 'window', onDrop: cb }), {
      initialProps: { cb: first },
    })
    rerender({ cb: second })
    fire(document.body, 'drop', transfer([file('a.txt')]))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('el resaltado no se queda colgado si el arrastre termina sin dragleave', () => {
    const { result } = renderHook(() => useFileDropZone({ scope: 'window', onDrop: vi.fn() }))
    fire(document.body, 'dragenter', transfer([file('a.txt')]))
    expect(result.current.isDragging).toBe(true)
    fire(document, 'pointermove')
    expect(result.current.isDragging).toBe(false)
  })

  describe('pegar', () => {
    it('entrega los archivos del portapapeles con nombre de captura si es genérico', () => {
      const onDrop = vi.fn()
      renderHook(() => useFileDropZone({ scope: 'window', acceptPaste: true, onDrop }))
      const event = fire(document.body, 'paste', transfer([new File(['x'], 'image.png', { type: 'image/png' })]))

      expect(event.defaultPrevented).toBe(true)
      const [dropped] = onDrop.mock.calls[0] as [{ files: File[] }]
      expect(dropped.files[0].name).toMatch(/^Captura \d{4}-\d{2}-\d{2} \d{2}\.\d{2}\.\d{2}\.png$/)
    })

    it('no hace nada si no se pidió acceptPaste', () => {
      const onDrop = vi.fn()
      renderHook(() => useFileDropZone({ scope: 'window', onDrop }))
      fire(document.body, 'paste', transfer([file('a.txt')]))
      expect(onDrop).not.toHaveBeenCalled()
    })

    it('pegar texto o pegar dentro de un campo no sube nada', () => {
      const onDrop = vi.fn()
      renderHook(() => useFileDropZone({ scope: 'window', acceptPaste: true, onDrop }))
      fire(document.body, 'paste', transfer([], { types: ['text/plain'] }))

      const input = document.createElement('input')
      document.body.appendChild(input)
      const event = fire(input, 'paste', transfer([file('a.txt')]))
      input.remove()

      expect(onDrop).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(false)
    })
  })
})

describe('useFileDropZone — scope element', () => {
  type Drop = Parameters<Parameters<typeof useFileDropZone>[0]['onDrop']>[0]
  function Harness({ onZone, onWindow }: { onZone: (d: Drop) => void; onWindow: (d: Drop) => void }) {
    useFileDropZone({ scope: 'window', onDrop: onWindow })
    const { isDragging, dropProps } = useFileDropZone({ scope: 'element', onDrop: onZone })
    return (
      <div data-testid="zone" data-dragging={isDragging} {...dropProps}>
        <span data-testid="child">zona</span>
      </div>
    )
  }

  it('resalta solo la zona, sin parpadear al cruzar hijos, y entrega los archivos una vez', () => {
    const onZone = vi.fn()
    const onWindow = vi.fn()
    render(<Harness onZone={onZone} onWindow={onWindow} />)
    const zone = screen.getByTestId('zone')
    const a = file('a.txt')
    const dt = transfer([a])

    fireEvent.dragEnter(zone, { dataTransfer: dt })
    fireEvent.dragEnter(screen.getByTestId('child'), { dataTransfer: dt })
    fireEvent.dragLeave(zone, { dataTransfer: dt })
    expect(zone.dataset.dragging).toBe('true')

    fireEvent.drop(screen.getByTestId('child'), { dataTransfer: dt })
    expect(zone.dataset.dragging).toBe('false')
    expect(onZone).toHaveBeenCalledTimes(1)
    expect(onZone).toHaveBeenCalledWith({ files: [a], directories: [] })
    // La zona de pantalla completa NO debe recibir el mismo drop (duplicaría la subida)
    expect(onWindow).not.toHaveBeenCalled()
  })

  it('fuera de la zona, la zona de pantalla completa sigue funcionando', () => {
    const onZone = vi.fn()
    const onWindow = vi.fn()
    render(<Harness onZone={onZone} onWindow={onWindow} />)
    fire(document.body, 'drop', transfer([file('a.txt')]))
    expect(onWindow).toHaveBeenCalledTimes(1)
    expect(onZone).not.toHaveBeenCalled()
  })
})

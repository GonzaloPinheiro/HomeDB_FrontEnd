import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useFileDropZone } from './useFileDropZone'

const toastError = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { error: toastError } }))

const file = (name: string) => new File(['x'], name)

/** Doble mínimo de DataTransfer: lo que el hook lee (types, files, items). */
function transfer(files: File[], options: { directories?: number; types?: string[] } = {}) {
  const items = [
    ...files.map((f) => ({ kind: 'file', getAsFile: () => f, webkitGetAsEntry: () => ({ isDirectory: false }) })),
    ...Array.from({ length: options.directories ?? 0 }, () => ({
      kind: 'file',
      getAsFile: () => new File([], 'carpeta'),
      webkitGetAsEntry: () => ({ isDirectory: true }),
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

beforeEach(() => toastError.mockClear())
// Sin globals de Vitest, RTL no desmonta solo: los listeners de document de un test se acumularían en el siguiente.
afterEach(cleanup)

describe('useFileDropZone — scope window', () => {
  it('resalta mientras se arrastran archivos y se apaga al salir (con hijos de por medio)', () => {
    const { result } = renderHook(() => useFileDropZone({ scope: 'window', onFiles: vi.fn() }))
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
    const { result } = renderHook(() => useFileDropZone({ scope: 'window', onFiles: vi.fn() }))
    fire(document.body, 'dragenter', transfer([], { types: ['text/plain'] }))
    expect(result.current.isDragging).toBe(false)
  })

  it('al soltar entrega los archivos, apaga el resaltado y permite el drop', () => {
    const onFiles = vi.fn()
    const { result } = renderHook(() => useFileDropZone({ scope: 'window', onFiles }))
    const a = file('a.txt')
    const dt = transfer([a])

    fire(document.body, 'dragenter', dt)
    const over = fire(document.body, 'dragover', dt)
    expect(over.defaultPrevented).toBe(true)
    expect(dt.dropEffect).toBe('copy')
    const drop = fire(document.body, 'drop', dt)

    expect(drop.defaultPrevented).toBe(true)
    expect(onFiles).toHaveBeenCalledWith([a])
    expect(result.current.isDragging).toBe(false)
  })

  it('avisa de las carpetas, no las entrega, y sube el resto', () => {
    const onFiles = vi.fn()
    renderHook(() => useFileDropZone({ scope: 'window', onFiles }))
    const a = file('a.txt')
    fire(document.body, 'drop', transfer([a], { directories: 2 }))

    expect(toastError).toHaveBeenCalledTimes(1)
    expect(onFiles).toHaveBeenCalledWith([a])
  })

  it('solo carpetas: avisa y no llama a onFiles', () => {
    const onFiles = vi.fn()
    renderHook(() => useFileDropZone({ scope: 'window', onFiles }))
    fire(document.body, 'drop', transfer([], { directories: 1 }))
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(onFiles).not.toHaveBeenCalled()
  })

  it('desactivado no escucha nada', () => {
    const onFiles = vi.fn()
    const { result } = renderHook(() => useFileDropZone({ scope: 'window', enabled: false, onFiles }))
    fire(document.body, 'dragenter', transfer([file('a.txt')]))
    fire(document.body, 'drop', transfer([file('a.txt')]))
    expect(result.current.isDragging).toBe(false)
    expect(onFiles).not.toHaveBeenCalled()
  })

  it('usa siempre el onFiles más reciente sin reengancharse', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ cb }) => useFileDropZone({ scope: 'window', onFiles: cb }), {
      initialProps: { cb: first },
    })
    rerender({ cb: second })
    fire(document.body, 'drop', transfer([file('a.txt')]))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('el resaltado no se queda colgado si el arrastre termina sin dragleave', () => {
    const { result } = renderHook(() => useFileDropZone({ scope: 'window', onFiles: vi.fn() }))
    fire(document.body, 'dragenter', transfer([file('a.txt')]))
    expect(result.current.isDragging).toBe(true)
    fire(document, 'pointermove')
    expect(result.current.isDragging).toBe(false)
  })

  describe('pegar', () => {
    it('entrega los archivos del portapapeles con nombre de captura si es genérico', () => {
      const onFiles = vi.fn()
      renderHook(() => useFileDropZone({ scope: 'window', acceptPaste: true, onFiles }))
      const event = fire(document.body, 'paste', transfer([new File(['x'], 'image.png', { type: 'image/png' })]))

      expect(event.defaultPrevented).toBe(true)
      const [files] = onFiles.mock.calls[0] as [File[]]
      expect(files[0].name).toMatch(/^Captura \d{4}-\d{2}-\d{2} \d{2}\.\d{2}\.\d{2}\.png$/)
    })

    it('no hace nada si no se pidió acceptPaste', () => {
      const onFiles = vi.fn()
      renderHook(() => useFileDropZone({ scope: 'window', onFiles }))
      fire(document.body, 'paste', transfer([file('a.txt')]))
      expect(onFiles).not.toHaveBeenCalled()
    })

    it('pegar texto o pegar dentro de un campo no sube nada', () => {
      const onFiles = vi.fn()
      renderHook(() => useFileDropZone({ scope: 'window', acceptPaste: true, onFiles }))
      fire(document.body, 'paste', transfer([], { types: ['text/plain'] }))

      const input = document.createElement('input')
      document.body.appendChild(input)
      const event = fire(input, 'paste', transfer([file('a.txt')]))
      input.remove()

      expect(onFiles).not.toHaveBeenCalled()
      expect(event.defaultPrevented).toBe(false)
    })
  })
})

describe('useFileDropZone — scope element', () => {
  function Harness({ onZone, onWindow }: { onZone: (f: File[]) => void; onWindow: (f: File[]) => void }) {
    useFileDropZone({ scope: 'window', onFiles: onWindow })
    const { isDragging, dropProps } = useFileDropZone({ scope: 'element', onFiles: onZone })
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
    expect(onZone).toHaveBeenCalledWith([a])
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

import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useExplorerShortcuts } from './useExplorerShortcuts'

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

function setup(options: { enabled?: boolean; hasSelection?: boolean } = {}) {
  const handlers = { onDelete: vi.fn(), onRename: vi.fn(), onSelectAll: vi.fn(), onClear: vi.fn() }
  renderHook(() =>
    useExplorerShortcuts(handlers, { enabled: options.enabled ?? true, hasSelection: options.hasSelection ?? true }),
  )
  return handlers
}

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}

describe('useExplorerShortcuts', () => {
  it('Supr elimina la selección', () => {
    const handlers = setup()
    const event = press('Delete')
    expect(handlers.onDelete).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('⌘⌫ elimina (Mac), pero Backspace a secas no', () => {
    const handlers = setup()
    press('Backspace')
    expect(handlers.onDelete).not.toHaveBeenCalled()
    press('Backspace', { metaKey: true })
    expect(handlers.onDelete).toHaveBeenCalledTimes(1)
  })

  it('F2 renombra y Esc vacía la selección', () => {
    const handlers = setup()
    press('F2')
    press('Escape')
    expect(handlers.onRename).toHaveBeenCalledTimes(1)
    expect(handlers.onClear).toHaveBeenCalledTimes(1)
  })

  it('Ctrl/Cmd+A selecciona todo y evita la selección de texto del navegador, incluso sin selección previa', () => {
    const handlers = setup({ hasSelection: false })
    const ctrl = press('a', { ctrlKey: true })
    const meta = press('A', { metaKey: true })
    expect(handlers.onSelectAll).toHaveBeenCalledTimes(2)
    expect(ctrl.defaultPrevented).toBe(true)
    expect(meta.defaultPrevented).toBe(true)
  })

  it('sin selección, Supr / F2 / Esc no hacen nada', () => {
    const handlers = setup({ hasSelection: false })
    press('Delete')
    press('F2')
    press('Escape')
    expect(handlers.onDelete).not.toHaveBeenCalled()
    expect(handlers.onRename).not.toHaveBeenCalled()
    expect(handlers.onClear).not.toHaveBeenCalled()
  })

  it('escribiendo en un campo (buscador) no dispara nada, ni siquiera Ctrl+A', () => {
    const handlers = setup()
    const input = document.createElement('input')
    document.body.appendChild(input)
    press('Delete', {}, input)
    const selectAll = press('a', { ctrlKey: true }, input)
    expect(handlers.onDelete).not.toHaveBeenCalled()
    expect(handlers.onSelectAll).not.toHaveBeenCalled()
    expect(selectAll.defaultPrevented).toBe(false)
  })

  it('con un diálogo o un menú abierto el teclado es suyo', () => {
    const handlers = setup()
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.appendChild(dialog)
    press('Delete')
    press('Escape')
    expect(handlers.onDelete).not.toHaveBeenCalled()
    expect(handlers.onClear).not.toHaveBeenCalled()
  })

  it('desactivado no escucha, y las combinaciones con Shift/Alt se ignoran', () => {
    const disabled = setup({ enabled: false })
    press('Delete')
    expect(disabled.onDelete).not.toHaveBeenCalled()

    cleanup()
    const handlers = setup()
    press('Delete', { shiftKey: true })
    press('F2', { altKey: true })
    expect(handlers.onDelete).not.toHaveBeenCalled()
    expect(handlers.onRename).not.toHaveBeenCalled()
  })
})

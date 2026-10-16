import { useEffect, useRef } from 'react'

// CLAUDE.md §6.3/§11: atajos de teclado del explorador. Actúan sobre la
// selección (no hay "elemento enfocado" distinto): Supr elimina, F2 renombra
// (solo con uno seleccionado), Ctrl/Cmd+A selecciona todo, Esc la vacía.

type Handlers = {
  onDelete: () => void
  onRename: () => void
  onSelectAll: () => void
  onClear: () => void
}

// Mientras haya un diálogo o un menú abierto el teclado es suyo: Radix ya
// gestiona Esc y el foco ahí, y un Supr dentro de un menú no debe borrar nada.
const OVERLAY_SELECTOR = '[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"]'

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function useExplorerShortcuts(handlers: Handlers, { enabled, hasSelection }: { enabled: boolean; hasSelection: boolean }) {
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey) return
      if (isEditable(event.target) || document.querySelector(OVERLAY_SELECTOR)) return

      const mod = event.ctrlKey || event.metaKey
      const { onDelete, onRename, onSelectAll, onClear } = handlersRef.current

      if (mod && !event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault() // sin esto el navegador selecciona todo el texto de la página
        onSelectAll()
        return
      }
      if (mod) {
        // En Mac la tecla de borrar es ⌫ y Finder usa ⌘⌫ para eliminar
        if (event.metaKey && event.key === 'Backspace' && hasSelection) {
          event.preventDefault()
          onDelete()
        }
        return
      }
      if (event.shiftKey) return

      if (event.key === 'Delete' && hasSelection) {
        event.preventDefault()
        onDelete()
      } else if (event.key === 'F2' && hasSelection) {
        event.preventDefault()
        onRename()
      } else if (event.key === 'Escape' && hasSelection) {
        onClear()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled, hasSelection])
}

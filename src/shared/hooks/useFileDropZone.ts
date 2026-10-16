import { useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent } from 'react'
import { toast } from 'sonner'

import { dataTransferHasFiles, extractFiles, nameForPastedFile, type DataTransferLike } from '@/shared/lib/fileDrop'

// CLAUDE.md §6.3/§11: mecánica genérica de "soltar (o pegar) archivos del
// sistema sobre la web". NO sabe qué se hace con ellos (eso lo decide cada
// feature en `onFiles`): reutilizable por el explorador de archivos, el panel
// de subidas y, más adelante, otras pantallas (ej. torrents).
//
// Es HTML5 DnD nativo y no dnd-kit (§3, §10) porque dnd-kit solo mueve elementos
// de la propia página con eventos de puntero: soltar archivos desde el sistema
// operativo solo existe como eventos `drag*` nativos. No chocan: dnd-kit no
// emite ningún `dragenter`, y aquí se ignora todo arrastre que no lleve `Files`.

type Options = {
  /** Desactiva la escucha (y apaga el resaltado) — ej. mientras el usuario no tiene el módulo. */
  enabled?: boolean
  /**
   * `window`: escucha en todo el documento (soltar en cualquier parte de la
   * pantalla). `element`: solo en el elemento al que se le apliquen `dropProps`,
   * y no deja pasar el evento hacia arriba para no duplicar la subida con una
   * zona `window` activa a la vez.
   */
  scope: 'window' | 'element'
  onFiles: (files: File[]) => void
  /** Solo `window`: también acepta pegar con Ctrl/Cmd+V (capturas, archivos copiados del explorador). */
  acceptPaste?: boolean
}

type DragLike = {
  dataTransfer: DataTransfer | null
  preventDefault: () => void
  stopPropagation: () => void
}

type DropProps = {
  onDragEnter: (event: ReactDragEvent) => void
  onDragOver: (event: ReactDragEvent) => void
  onDragLeave: (event: ReactDragEvent) => void
  onDrop: (event: ReactDragEvent) => void
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function notifyDirectories(count: number): void {
  toast.error(
    count === 1
      ? 'No se puede subir una carpeta todavía — suelta los archivos de dentro'
      : `No se pueden subir ${count} carpetas todavía — suelta los archivos de dentro`,
  )
}

export function useFileDropZone({ enabled = true, scope, onFiles, acceptPaste = false }: Options): {
  isDragging: boolean
  /** Solo para `scope: 'element'`: se esparcen sobre el elemento que actúa de zona. */
  dropProps: DropProps
} {
  const [isDragging, setIsDragging] = useState(false)
  // dragenter/dragleave se disparan también al cruzar los hijos del elemento
  // (el resaltado parpadearía): se cuentan las entradas y se apaga al llegar a 0.
  const depth = useRef(0)
  const onFilesRef = useRef(onFiles)
  useEffect(() => {
    onFilesRef.current = onFiles
  })

  const handlers = useMemo(() => {
    const stopBubbling = scope === 'element'

    const deliver = (dataTransfer: DataTransferLike, transform?: (file: File) => File) => {
      const { files, directoryCount } = extractFiles(dataTransfer)
      if (directoryCount > 0) notifyDirectories(directoryCount)
      if (files.length > 0) onFilesRef.current(transform ? files.map((file) => transform(file)) : files)
    }

    const enter = (event: DragLike) => {
      if (!dataTransferHasFiles(event.dataTransfer)) return
      event.preventDefault()
      if (stopBubbling) event.stopPropagation()
      depth.current += 1
      setIsDragging(true)
    }

    const over = (event: DragLike) => {
      if (!event.dataTransfer || !dataTransferHasFiles(event.dataTransfer)) return
      event.preventDefault() // sin esto el navegador no permite soltar aquí
      if (stopBubbling) event.stopPropagation()
      event.dataTransfer.dropEffect = 'copy'
    }

    const leave = (event: DragLike) => {
      if (!dataTransferHasFiles(event.dataTransfer)) return
      if (stopBubbling) event.stopPropagation()
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setIsDragging(false)
    }

    const drop = (event: DragLike) => {
      if (!event.dataTransfer || !dataTransferHasFiles(event.dataTransfer)) return
      event.preventDefault()
      if (stopBubbling) event.stopPropagation()
      depth.current = 0
      setIsDragging(false)
      deliver(event.dataTransfer)
    }

    const paste = (event: ClipboardEvent) => {
      // Pegar texto en un campo (buscador, formularios) no es subir nada.
      if (isEditableTarget(event.target)) return
      const clipboard = event.clipboardData
      if (!clipboard || !dataTransferHasFiles(clipboard)) return
      event.preventDefault()
      deliver(clipboard, nameForPastedFile)
    }

    return { enter, over, leave, drop, paste }
  }, [scope])

  useEffect(() => {
    if (scope !== 'window' || !enabled) return

    const { enter, over, leave, drop, paste } = handlers
    document.addEventListener('dragenter', enter)
    document.addEventListener('dragover', over)
    document.addEventListener('dragleave', leave)
    document.addEventListener('drop', drop)
    if (acceptPaste) document.addEventListener('paste', paste)
    return () => {
      document.removeEventListener('dragenter', enter)
      document.removeEventListener('dragover', over)
      document.removeEventListener('dragleave', leave)
      document.removeEventListener('drop', drop)
      document.removeEventListener('paste', paste)
      // Si se desactiva (o la pantalla se desmonta) en pleno arrastre, no deja el resaltado colgado.
      depth.current = 0
      setIsDragging(false)
    }
  }, [scope, enabled, acceptPaste, handlers])

  // Salvaguarda: si el arrastre termina sin que llegue `dragleave`/`drop` (soltar fuera
  // de la ventana, Esc) el resaltado se quedaría colgado. Durante un arrastre nativo el
  // navegador no emite eventos de ratón/puntero ni de teclado: si llega uno, ya terminó.
  useEffect(() => {
    if (!isDragging) return
    const stop = () => {
      depth.current = 0
      setIsDragging(false)
    }
    document.addEventListener('pointermove', stop, { once: true })
    document.addEventListener('keydown', stop, { once: true })
    return () => {
      document.removeEventListener('pointermove', stop)
      document.removeEventListener('keydown', stop)
    }
  }, [isDragging])

  const dropProps: DropProps = {
    onDragEnter: handlers.enter,
    onDragOver: handlers.over,
    onDragLeave: handlers.leave,
    onDrop: handlers.drop,
  }

  return { isDragging: enabled && isDragging, dropProps }
}

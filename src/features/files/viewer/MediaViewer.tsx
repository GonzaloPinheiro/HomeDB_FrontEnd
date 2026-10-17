import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react'
import { useRef, type KeyboardEvent } from 'react'

import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/shared/components/ui/dialog'

import { ITEM_KEY_ATTRIBUTE, itemFocusKey } from '../useExplorerItemInteraction'
import { getMediaKind, type FileExplorerItem } from './media'
import { ViewerImage } from './ViewerImage'
import { ViewerVideo } from './ViewerVideo'

type MediaViewerProps = {
  /** Lo que se puede abrir de la carpeta visible, en su orden (useMediaViewer). */
  items: readonly FileExplorerItem[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  onDownload: (item: FileExplorerItem) => void
}

const ICON_BUTTON = 'text-header-text hover:bg-header-surface hover:text-header-text'
const NAV_BUTTON =
  'absolute top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full bg-header-surface text-header-text shadow-float hover:bg-header-border hover:text-header-text'

// CLAUDE.md §6.3c: visor de imagen y vídeo a pantalla completa (un "lightbox", no un
// modal de formulario: queda fuera de las dos tallas de §6.14). Radix Dialog da el
// foco atrapado, Esc, bloqueo del fondo y devolución del foco al elemento desde el
// que se abrió (§11). Barra oscura en ambos temas (--header-*, §6.1) sobre el
// overlay negro. Anterior/siguiente recorren las imágenes y vídeos de la carpeta
// visible; sin vuelta al principio, como el visor de fotos de Windows.
export function MediaViewer({ items, index, onIndexChange, onClose, onDownload }: MediaViewerProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const item = items[index]
  if (!item) return null

  const hasPrevious = index > 0
  const hasNext = index < items.length - 1
  const kind = getMediaKind(item.contentType)
  const download = () => onDownload(item)

  const onKeyDown = (event: KeyboardEvent) => {
    // Con el foco en el propio <video>, las flechas son suyas (saltar ±5 s)
    if (event.target instanceof HTMLMediaElement) return
    if (event.key === 'ArrowLeft' && hasPrevious) {
      event.preventDefault()
      onIndexChange(index - 1)
    } else if (event.key === 'ArrowRight' && hasNext) {
      event.preventDefault()
      onIndexChange(index + 1)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay className="bg-black/95" />
        <DialogPrimitive.Content
          ref={contentRef}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          // El foco inicial va al propio visor, no al primer botón: así las flechas
          // funcionan nada más abrirlo y no aparece un anillo de foco sin motivo
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            contentRef.current?.focus()
          }}
          // Radix solo devuelve el foco a un DialogTrigger, y el visor se abre desde una fila o
          // un menú, no desde uno: sin esto el foco se perdería en <body> al cerrar (§11). Va a la
          // fila del archivo que se estaba viendo (que con las flechas puede no ser el que se abrió).
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            document.querySelector<HTMLElement>(`[${ITEM_KEY_ATTRIBUTE}="${itemFocusKey(item)}"]`)?.focus()
          }}
          className="fixed inset-0 z-50 flex flex-col outline-none duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <header className="flex shrink-0 items-center gap-2 border-b border-header-border bg-header px-3 py-2 text-header-text">
            <DialogTitle className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</DialogTitle>
            <DialogDescription className="sr-only">
              Usa las flechas izquierda y derecha para pasar al archivo anterior o siguiente. Escape para cerrar.
            </DialogDescription>
            {items.length > 1 && (
              <span className="shrink-0 text-xs text-header-muted" aria-live="polite">
                {index + 1} de {items.length}
              </span>
            )}
            <Button variant="ghost" size="icon" className={ICON_BUTTON} onClick={download} aria-label="Descargar" title="Descargar">
              <Download />
            </Button>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className={ICON_BUTTON} aria-label="Cerrar" title="Cerrar (Esc)">
                <X />
              </Button>
            </DialogClose>
          </header>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center p-2 sm:p-4"
            // Clic en el fondo, fuera del medio, cierra (solo si el destino es el propio fondo)
            onClick={(event) => {
              if (event.target === event.currentTarget) onClose()
            }}
          >
            {/* key por archivo: al cambiar, el medio y su estado (carga, error, posición) empiezan de cero */}
            {kind === 'image' && <ViewerImage key={item.id} item={item} onDownload={download} />}
            {kind === 'video' && <ViewerVideo key={item.id} item={item} onDownload={download} />}

            {hasPrevious && (
              <Button variant="ghost" size="icon" className={`${NAV_BUTTON} left-2`} onClick={() => onIndexChange(index - 1)} aria-label="Anterior" title="Anterior (←)">
                <ChevronLeft />
              </Button>
            )}
            {hasNext && (
              <Button variant="ghost" size="icon" className={`${NAV_BUTTON} right-2`} onClick={() => onIndexChange(index + 1)} aria-label="Siguiente" title="Siguiente (→)">
                <ChevronRight />
              </Button>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}

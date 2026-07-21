import type { ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { cn } from '@/shared/lib/utils'

type ModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /**
   * CLAUDE.md §6.14: dos variantes estándar, no una talla por pantalla.
   * small (~380px): confirmaciones y edición de un campo.
   * large (~560px, ~460px de alto mínimo): contenido con secciones/pestañas
   * que crecerá con el tiempo (el modal de Usuarios es el caso de referencia).
   */
  size?: 'small' | 'large'
  children: ReactNode
  /** Pie estándar §6.4: botón secundario con borde + primario de acento, los pasa el caller. */
  footer?: ReactNode
}

// CLAUDE.md §6.4: modal único de toda la app — overlay oscuro, tarjeta centrada
// de radio 16px, cabecera con título + cerrar, pie con acciones. El foco
// atrapado, Escape y la devolución de foco los resuelve Radix Dialog.
export function Modal({ open, onOpenChange, title, size = 'small', children, footer }: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex flex-col rounded-2xl bg-card sm:rounded-2xl',
          size === 'small' ? 'max-w-[380px]' : 'max-w-[560px] min-h-[460px]',
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-text-primary">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1">{children}</div>
        {footer ? <div className="flex justify-end gap-2">{footer}</div> : null}
      </DialogContent>
    </Dialog>
  )
}

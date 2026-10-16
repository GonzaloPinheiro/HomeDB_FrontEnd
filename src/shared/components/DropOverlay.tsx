import { AnimatePresence, motion } from 'framer-motion'
import { UploadCloud } from 'lucide-react'

type DropOverlayProps = {
  visible: boolean
  title: string
  description?: string
}

// CLAUDE.md §6.3: aviso a pantalla completa mientras se arrastran archivos del
// sistema por encima de la web. `pointer-events-none` para que no intercepte
// nada: el `drop` llega a los elementos de debajo y lo recoge useFileDropZone.
// Genérico a propósito (título y descripción por props) para reutilizarlo en
// otras pantallas que acepten archivos.
export function DropOverlay({ visible, title, description }: DropOverlayProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="pointer-events-none fixed inset-0 z-[60] p-3"
          aria-hidden
        >
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-accent bg-[color-mix(in_srgb,var(--accent-tint-bg)_88%,transparent)] text-center">
            <UploadCloud className="h-10 w-10 text-accent" />
            <p className="text-lg font-semibold text-accent-tint-text">{title}</p>
            {description ? <p className="max-w-sm text-sm text-accent-tint-text">{description}</p> : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

import { CircleAlert, Download, RotateCw } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'

type ViewerErrorProps = {
  title: string
  description: string
  /** Sin esto no se ofrece "Reintentar" (un formato no soportado no se arregla repitiendo). */
  onRetry?: () => void
  onDownload: () => void
}

// CLAUDE.md §6.3c: estado de error del visor — siempre con una salida útil: poder
// descargar el archivo y verlo con otra aplicación. Colores de la cabecera
// (§6.1, --header-*): el visor es oscuro en ambos temas.
export function ViewerError({ title, description, onRetry, onDownload }: ViewerErrorProps) {
  return (
    <div role="alert" className="flex max-w-md flex-col items-center gap-3 px-6 text-center text-header-text">
      <CircleAlert className="h-10 w-10 text-header-muted" aria-hidden />
      <p className="text-base font-medium">{title}</p>
      <p className="text-sm text-header-muted">{description}</p>
      <div className="mt-1 flex gap-2">
        {onRetry && (
          <Button variant="ghost" onClick={onRetry} className="bg-header-surface text-header-text hover:bg-header-border hover:text-header-text">
            <RotateCw />
            Reintentar
          </Button>
        )}
        <Button variant="ghost" onClick={onDownload} className="bg-header-surface text-header-text hover:bg-header-border hover:text-header-text">
          <Download />
          Descargar
        </Button>
      </div>
    </div>
  )
}

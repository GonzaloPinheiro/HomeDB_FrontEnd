import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/shared/lib/utils'

import { streamUrl, type FileExplorerItem } from './media'
import { useMediaRetry } from './useMediaRetry'
import { ViewerError } from './ViewerError'

type ViewerImageProps = {
  item: FileExplorerItem
  onDownload: () => void
}

// CLAUDE.md §6.3c: imagen ajustada a la pantalla, sin zoom ni edición a propósito
// (cada gesto extra es una fuente de fallos que no compensa). Se lee del endpoint de
// streaming, que la sirve en línea. Sin `crossOrigin`: con él la petición iría sin
// cookies y la API (§5.2) respondería 401. Va con `key` por archivo desde el visor,
// así el estado de carga/error se reinicia solo al pasar a otra imagen.
export function ViewerImage({ item, onDownload }: ViewerImageProps) {
  const { attempt, failed, onError, retry } = useMediaRetry()
  const [loaded, setLoaded] = useState(false)

  if (failed) {
    return (
      <ViewerError
        title="No se pudo cargar la imagen"
        description="Puede que el archivo ya no esté disponible o que la conexión haya fallado."
        onRetry={() => void retry()}
        onDownload={onDownload}
      />
    )
  }

  return (
    <>
      {!loaded && <Loader2 className="absolute h-8 w-8 animate-spin text-header-muted" aria-label="Cargando imagen" />}
      <img
        key={attempt}
        src={streamUrl(item.id)}
        alt={item.name}
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={onError}
        className={cn('max-h-full max-w-full select-none object-contain transition-opacity', loaded ? 'opacity-100' : 'opacity-0')}
      />
    </>
  )
}

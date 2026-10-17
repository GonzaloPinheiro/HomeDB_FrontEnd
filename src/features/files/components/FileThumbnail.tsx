import { useState } from 'react'

import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/utils'

import { supportsThumbnail, THUMBNAILS_ENABLED, thumbnailUrl } from '../thumbnails'
import type { ExplorerItem } from '../types'
import { ItemIcon } from './ItemIcon'

type LoadState = 'loading' | 'loaded' | 'failed'

// CLAUDE.md §6.3b: contenido de la zona de imagen de una tarjeta. Miniatura si
// el endpoint existe (THUMBNAILS_ENABLED) y el tipo la admite; en cualquier otro
// caso, el icono grande del tipo — también si la miniatura falla al cargar
// (404, 429, 401…), sin reintentar: un reintento automático por tarjeta gastaría
// el cupo del rate limiter global (§7.4) justo cuando ya está agotándose.
// El estado vive aquí y se reinicia solo porque FileCard va con key por elemento.
export function FileThumbnail({ item }: { item: ExplorerItem }) {
  const [state, setState] = useState<LoadState>('loading')

  if (item.kind === 'file' && THUMBNAILS_ENABLED && supportsThumbnail(item.contentType) && state !== 'failed') {
    return (
      <>
        {state === 'loading' && <Skeleton className="absolute inset-0 rounded-none" aria-hidden />}
        <img
          src={thumbnailUrl(item.id)}
          // El nombre ya se muestra bajo la tarjeta: la imagen es decorativa
          alt=""
          // Carga diferida nativa: solo se piden las miniaturas cercanas a la pantalla
          loading="lazy"
          decoding="async"
          // Sin `crossOrigin`: con él la petición iría sin cookies y la API (§5.2) respondería 401
          draggable={false}
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
          // pointer-events-none: el arrastre nativo de la imagen competiría con dnd-kit (§7.5)
          className={cn(
            'pointer-events-none h-full w-full select-none object-cover transition-opacity',
            state === 'loaded' ? 'opacity-100' : 'opacity-0',
          )}
        />
      </>
    )
  }

  return <ItemIcon item={item} className="h-12 w-12" />
}

import type { UseQueryResult } from '@tanstack/react-query'
import { CircleCheck } from 'lucide-react'
import type { ReactNode } from 'react'

import { toApiError } from '@/shared/api/client'
import { FloatCard } from '@/shared/components/FloatCard'
import { InlineMessage } from '@/shared/components/InlineMessage'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/utils'

type InsightCardProps<T> = {
  title: string
  /** Una línea que dice QUÉ cuenta la tarjeta: los datos del backend no se explican solos (§5.4). */
  description: string
  /** Resumen a la derecha del título ("12 en 24 h"); se omite mientras no hay datos. */
  meta?: string
  /** Selector de rango o de umbral. */
  controls: ReactNode
  query: UseQueryResult<T[]>
  /** Estado vacío: aquí vacío es una BUENA noticia (nada falla, nada es lento). */
  emptyTitle: string
  emptyDescription: string
  /** Aviso final sobre los límites del dato; solo cuando hay filas. */
  footnote?: string
  /** Las filas, cuando ya hay datos. */
  children: (items: T[]) => ReactNode
}

// Marco común de las dos tarjetas de análisis (excepciones críticas y operaciones lentas, §6.23): mismo
// aspecto que las tarjetas "Top 10" de AdGuard (§6.21) y los mismos cuatro estados (cargando, error,
// vacío, datos) en un único sitio, para que ninguna de las dos los reimplemente.
export function InsightCard<T>({
  title,
  description,
  meta,
  controls,
  query,
  emptyTitle,
  emptyDescription,
  footnote,
  children,
}: InsightCardProps<T>) {
  return (
    <FloatCard className="min-w-0 p-5 sm:px-[22px]">
      <div className="flex items-baseline justify-between gap-2.5">
        <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>
        {meta !== undefined && <span className="whitespace-nowrap text-xs text-text-secondary">{meta}</span>}
      </div>
      <p className="mt-1 text-xs text-text-secondary">{description}</p>
      <div className="mt-3">{controls}</div>

      <div className="mt-2.5" aria-busy={query.isPending || query.isFetching}>
        {query.isPending ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="my-1.5 h-7 w-full" />)
        ) : query.data === undefined ? (
          // `data === undefined` y no `isError` (§7.1): un refetch fallido deja el último dato visible
          <div className="flex flex-col items-start gap-3 py-2">
            <InlineMessage tone="critical">{toApiError(query.error).message}</InlineMessage>
            <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : query.data.length === 0 ? (
          <div className="flex items-center gap-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-positive-bg text-positive-text">
              <CircleCheck className="h-[18px] w-[18px]" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">{emptyTitle}</p>
              <p className="text-xs text-text-secondary">{emptyDescription}</p>
            </div>
          </div>
        ) : (
          // Al cambiar de rango se enseña el dato anterior atenuado hasta que llega el nuevo
          <div className={cn('transition-opacity', query.isPlaceholderData && 'opacity-50')}>
            {children(query.data)}
            {footnote !== undefined && <p className="mt-2 text-xs text-text-muted">{footnote}</p>}
          </div>
        )}
      </div>
    </FloatCard>
  )
}

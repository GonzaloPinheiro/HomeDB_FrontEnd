import type { UseQueryResult } from '@tanstack/react-query'
import { CircleAlert, type LucideIcon } from 'lucide-react'
import { useId, type ReactNode, type Ref } from 'react'

import { toApiError } from '@/shared/api/client'
import { EmptyState } from '@/shared/components/EmptyState'
import { FloatCard } from '@/shared/components/FloatCard'
import { Pagination } from '@/shared/components/Pagination'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'

/** Forma común de las respuestas paginadas de las tablas de Admin (Registros y Auditoría). */
export type PagedResult<T> = { items: T[]; totalCount: number; totalPages: number }

type TableCardProps<T> = {
  /** La sección es el destino del scroll y del foco cuando se llega desde un drill-down (§11). */
  ref?: Ref<HTMLElement>
  title: string
  /** A la derecha del título ("Más recientes primero"). */
  meta?: string
  /** La barra de filtros (§6.6). */
  filters: ReactNode
  /** Bajo los filtros: chips de filtros activos. */
  belowFilters?: ReactNode
  query: UseQueryResult<PagedResult<T>>
  page: number
  onPageChange: (page: number) => void
  hasActiveFilters: boolean
  onClearFilters: () => void
  emptyIcon: LucideIcon
  /** Texto del estado vacío con filtros activos y sin ellos. */
  emptyMessages: { filtered: string; none: string }
  /** La tabla, cuando ya hay filas. */
  children: (items: T[]) => ReactNode
}

// Tarjeta de tabla de Admin (§6.23, §6.24): cabecera con título y filtros, los cuatro estados (cargando,
// error, vacío, datos) y la paginación, en un único sitio para que Registros y Auditoría no los
// reimplementen. Es una sección con nombre (`aria-labelledby`) y `tabIndex={-1}`, para llevarle el foco
// tras un drill-down (§11).
export function TableCard<T>({
  ref,
  title,
  meta,
  filters,
  belowFilters,
  query,
  page,
  onPageChange,
  hasActiveFilters,
  onClearFilters,
  emptyIcon,
  emptyMessages,
  children,
}: TableCardProps<T>) {
  const titleId = useId()

  return (
    <section ref={ref} tabIndex={-1} aria-labelledby={titleId} className="scroll-mt-4 outline-none">
      <FloatCard className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border-light p-4 sm:px-[22px]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 id={titleId} className="text-[15px] font-semibold text-text-primary">
              {title}
            </h2>
            {meta !== undefined && <span className="text-xs text-text-secondary">{meta}</span>}
          </div>
          {filters}
          {belowFilters}
        </div>

        {query.isPending ? (
          // §6.10: skeleton con forma de filas de tabla
          <div className="flex flex-col gap-1 p-3" aria-hidden>
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 px-2 py-1.5">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-5 w-16 rounded-md" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : query.data === undefined ? (
          // `data === undefined` y no `isError` (§7.1): un refetch fallido deja la última página visible
          <EmptyState
            icon={CircleAlert}
            title="No se pudo cargar la lista"
            description={toApiError(query.error).message}
            action={
              <Button variant="outline" onClick={() => void query.refetch()}>
                Reintentar
              </Button>
            }
          />
        ) : query.data.items.length === 0 ? (
          <EmptyState
            icon={emptyIcon}
            title="Sin resultados"
            description={hasActiveFilters ? emptyMessages.filtered : emptyMessages.none}
            action={
              hasActiveFilters ? (
                <Button variant="outline" onClick={onClearFilters}>
                  Limpiar filtros
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {children(query.data.items)}
            <div className="border-t border-border-light px-4 py-3 sm:px-[22px]">
              <Pagination
                page={page}
                totalPages={query.data.totalPages}
                totalCount={query.data.totalCount}
                onPageChange={onPageChange}
              />
            </div>
          </>
        )}
      </FloatCard>
    </section>
  )
}

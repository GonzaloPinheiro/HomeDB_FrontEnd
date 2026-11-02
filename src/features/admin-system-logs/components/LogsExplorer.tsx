import { CircleAlert, ScrollText } from 'lucide-react'
import type { Ref } from 'react'

import { toApiError } from '@/shared/api/client'
import { EmptyState } from '@/shared/components/EmptyState'
import { FloatCard } from '@/shared/components/FloatCard'
import { Pagination } from '@/shared/components/Pagination'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'

import { useLogs, type LogsFilters } from '../api'
import type { LogsFiltersState } from '../useLogsFilters'
import { LogsFilterBar } from './LogsFilterBar'
import { LogsTable } from './LogsTable'

type LogsExplorerProps = {
  state: LogsFiltersState
  /** Leve la vista a unos filtros concretos (y la pantalla hasta aquí): "ver toda la petición". */
  onShowOnly: (filters: Partial<LogsFilters>) => void
  /** La sección es el destino del scroll y del foco cuando se llega desde las tarjetas de análisis. */
  ref?: Ref<HTMLElement>
}

// CLAUDE.md §6.23: la tabla de registros dentro de una tarjeta flotante, con sus filtros en la cabecera.
// Es una sección con nombre (`aria-labelledby`) y `tabIndex={-1}` para poder llevarle el foco tras un
// drill-down desde las tarjetas de arriba (§11).
export function LogsExplorer({ state, onShowOnly, ref }: LogsExplorerProps) {
  const { filters, page } = state
  const query = useLogs(filters, page)

  return (
    <section ref={ref} tabIndex={-1} aria-labelledby="logs-explorer-title" className="scroll-mt-4 outline-none">
      <FloatCard className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border-light p-4 sm:px-[22px]">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 id="logs-explorer-title" className="text-[15px] font-semibold text-text-primary">
              Registros
            </h2>
            <span className="text-xs text-text-secondary">Más recientes primero</span>
          </div>
          <LogsFilterBar state={state} />
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
            icon={ScrollText}
            title="Sin resultados"
            description={
              state.activeFilterCount > 0
                ? 'Ningún registro coincide con los filtros activos.'
                : 'Todavía no hay registros.'
            }
            action={
              state.activeFilterCount > 0 ? (
                <Button variant="outline" onClick={state.clearFilters}>
                  Limpiar filtros
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <LogsTable
              rows={query.data.items}
              onShowRequest={(correlationId) => onShowOnly({ correlationId })}
            />
            <div className="border-t border-border-light px-4 py-3 sm:px-[22px]">
              <Pagination
                page={page}
                totalPages={query.data.totalPages}
                totalCount={query.data.totalCount}
                onPageChange={state.setPage}
              />
            </div>
          </>
        )}
      </FloatCard>
    </section>
  )
}

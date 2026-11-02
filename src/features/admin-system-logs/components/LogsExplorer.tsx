import { ScrollText } from 'lucide-react'
import type { Ref } from 'react'

import { TableCard } from '@/shared/components/TableCard'

import { useLogs, type LogsFilters } from '../api'
import type { LogsFiltersState } from '../useLogsFilters'
import { LogsFilterBar } from './LogsFilterBar'
import { LogsTable } from './LogsTable'

type LogsExplorerProps = {
  state: LogsFiltersState
  /** Lleva la vista a unos filtros concretos (y la pantalla hasta aquí): "ver toda la petición". */
  onShowOnly: (filters: Partial<LogsFilters>) => void
  ref?: Ref<HTMLElement>
}

// CLAUDE.md §6.23: la tabla de registros dentro de la tarjeta de tabla compartida, con sus filtros.
export function LogsExplorer({ state, onShowOnly, ref }: LogsExplorerProps) {
  const query = useLogs(state.filters, state.page)

  return (
    <TableCard
      ref={ref}
      title="Registros"
      meta="Más recientes primero"
      filters={<LogsFilterBar state={state} />}
      query={query}
      page={state.page}
      onPageChange={state.setPage}
      hasActiveFilters={state.activeFilterCount > 0}
      onClearFilters={state.clearFilters}
      emptyIcon={ScrollText}
      emptyMessages={{
        filtered: 'Ningún registro coincide con los filtros activos.',
        none: 'Todavía no hay registros.',
      }}
    >
      {(items) => <LogsTable rows={items} onShowRequest={(correlationId) => onShowOnly({ correlationId })} />}
    </TableCard>
  )
}

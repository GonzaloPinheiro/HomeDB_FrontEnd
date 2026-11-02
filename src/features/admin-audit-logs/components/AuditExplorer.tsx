import { ClipboardList } from 'lucide-react'

import { TableCard } from '@/shared/components/TableCard'

import { useAuditLogs } from '../api'
import { actionDrillDown, buildFilterChips, filteredUserName, userDrillDown } from '../presentation'
import type { AuditFiltersState } from '../useAuditFilters'
import { ActiveFilterChips } from './ActiveFilterChips'
import { AuditFilterBar } from './AuditFilterBar'
import { AuditTable } from './AuditTable'

// CLAUDE.md §6.24: la tabla de auditoría dentro de la tarjeta de tabla compartida, con sus filtros y, debajo,
// los chips de los filtros activos. Pulsar un usuario o una acción de una fila SUMA ese filtro a los activos.
export function AuditExplorer({ state }: { state: AuditFiltersState }) {
  const query = useAuditLogs(state.filters, state.page)
  const chips = buildFilterChips(state.filters, filteredUserName(state.filters, query.data?.items))

  return (
    <TableCard
      title="Auditoría"
      meta="Más recientes primero"
      filters={<AuditFilterBar state={state} />}
      belowFilters={<ActiveFilterChips chips={chips} onRemove={state.setFilter} />}
      query={query}
      page={state.page}
      onPageChange={state.setPage}
      hasActiveFilters={state.activeFilterCount > 0}
      onClearFilters={state.clearFilters}
      emptyIcon={ClipboardList}
      emptyMessages={{
        filtered: 'Ningún registro de auditoría coincide con los filtros activos.',
        none: 'Todavía no hay registros de auditoría.',
      }}
    >
      {(items) => (
        <AuditTable
          rows={items}
          onSelectUser={(entry) => state.setFilter(userDrillDown(entry.userId))}
          onSelectAction={(entry) => state.setFilter(actionDrillDown(entry.action))}
        />
      )}
    </TableCard>
  )
}

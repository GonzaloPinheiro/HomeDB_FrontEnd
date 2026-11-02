import { FilterBar } from '@/shared/components/FilterBar'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

import { LOG_LEVELS } from '../types'
import type { LogsFiltersState } from '../useLogsFilters'

// CLAUDE.md §6.6: select de nivel + búsqueda de Operación siempre visibles; rango de fechas y
// CorrelationId (campo técnico, poco frecuente) dentro del panel "Filtros".
export function LogsFilterBar({ state }: { state: LogsFiltersState }) {
  const { filters, setFilter, operationField } = state

  return (
    <FilterBar
      activeFilterCount={state.activeFilterCount}
      onClear={state.clearFilters}
      panel={
        <>
          <p className="text-sm font-medium text-text-primary">Rango de fechas</p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="filter-from" className="text-xs text-text-secondary">
              Desde
            </Label>
            <Input
              id="filter-from"
              type="date"
              value={filters.from ?? ''}
              onChange={(event) => setFilter({ from: event.target.value || null })}
            />
            <Label htmlFor="filter-to" className="text-xs text-text-secondary">
              Hasta
            </Label>
            <Input
              id="filter-to"
              type="date"
              value={filters.to ?? ''}
              onChange={(event) => setFilter({ to: event.target.value || null })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="filter-correlation" className="text-xs text-text-secondary">
              CorrelationId
            </Label>
            <Input
              id="filter-correlation"
              value={filters.correlationId ?? ''}
              onChange={(event) => setFilter({ correlationId: event.target.value || null })}
              placeholder="Id de correlación"
              className="font-mono text-xs"
            />
          </div>
        </>
      }
    >
      <Select
        value={filters.level ?? 'all'}
        onValueChange={(value) => setFilter({ level: value === 'all' ? null : value })}
      >
        <SelectTrigger className="h-9 w-44" aria-label="Filtrar por nivel">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los niveles</SelectItem>
          {LOG_LEVELS.map((level) => (
            <SelectItem key={level} value={level}>
              {level}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={operationField.value}
        onChange={(event) => operationField.onChange(event.target.value)}
        placeholder="Buscar por operación"
        className="h-9 w-full sm:w-56"
        aria-label="Buscar por operación"
      />
    </FilterBar>
  )
}

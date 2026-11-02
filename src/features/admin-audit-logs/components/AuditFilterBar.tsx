import { FilterBar } from '@/shared/components/FilterBar'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { usePermissions } from '@/shared/hooks/usePermissions'

import { actionLabel } from '../actions'
import { userDrillDown } from '../presentation'
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '../types'
import type { AuditFiltersState } from '../useAuditFilters'
import { UserPicker } from './UserPicker'

// CLAUDE.md §6.6/§6.24: la búsqueda de usuario y la acción, siempre visibles (los dos filtros más usados);
// rango de fechas, tipo de recurso y usuario exacto dentro del panel "Filtros".
export function AuditFilterBar({ state }: { state: AuditFiltersState }) {
  const { filters, setFilter, textField } = state
  // El selector de usuario exacto lee `GET /admin/users`, que exige el módulo UserManagement (§5.4): sin él
  // no se ofrece (la búsqueda por texto y el clic en un usuario de la tabla siguen funcionando)
  const { hasModule } = usePermissions()
  const canPickUser = hasModule('UserManagement')

  return (
    <FilterBar
      activeFilterCount={state.activeFilterCount}
      onClear={state.clearFilters}
      panel={
        <>
          {canPickUser && (
            <UserPicker
              selectedUserId={filters.userId}
              onSelect={(user) => setFilter(userDrillDown(user.id))}
            />
          )}
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
            <Label htmlFor="filter-resource-type" className="text-xs text-text-secondary">
              Tipo de recurso
            </Label>
            <Select
              value={filters.resourceType ?? 'all'}
              onValueChange={(value) => setFilter({ resourceType: value === 'all' ? null : value })}
            >
              <SelectTrigger id="filter-resource-type" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {AUDIT_RESOURCE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      }
    >
      <Input
        value={textField.value}
        onChange={(event) => textField.onChange(event.target.value)}
        placeholder="Buscar por usuario"
        className="h-9 w-full sm:w-56"
        aria-label="Buscar por usuario"
      />
      <Select
        value={filters.action ?? 'all'}
        onValueChange={(value) => setFilter({ action: value === 'all' ? null : value })}
      >
        <SelectTrigger className="h-9 w-full sm:w-56" aria-label="Filtrar por acción">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las acciones</SelectItem>
          {AUDIT_ACTIONS.map((action) => (
            <SelectItem key={action} value={action}>
              {actionLabel(action)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterBar>
  )
}

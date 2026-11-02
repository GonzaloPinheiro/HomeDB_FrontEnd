import { Search, X } from 'lucide-react'

import { SegmentedControl, type SegmentedOption } from '@/shared/components/SegmentedControl'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'

import type { DeviceFilters, DeviceSort, StatusCounts, StatusFilter } from '../filters'
import type { VpnOwner } from '../types'

const SORT_OPTIONS: ReadonlyArray<{ value: DeviceSort; label: string }> = [
  { value: 'name', label: 'Orden: nombre' },
  { value: 'handshake', label: 'Orden: último handshake' },
  { value: 'traffic', label: 'Orden: tráfico' },
]

type VpnToolbarProps = {
  filters: DeviceFilters
  onFiltersChange: (filters: DeviceFilters) => void
  sort: DeviceSort
  onSortChange: (sort: DeviceSort) => void
  counts: StatusCounts
  owners: readonly VpnOwner[]
}

// CLAUDE.md §6.22: búsqueda por nombre o IP, estado con recuentos, dueño y orden. Todo se aplica
// en cliente sobre lo ya cargado. En móvil cada control ocupa su línea.
export function VpnToolbar({ filters, onFiltersChange, sort, onSortChange, counts, owners }: VpnToolbarProps) {
  const statusOptions: ReadonlyArray<SegmentedOption<StatusFilter>> = [
    { value: 'all', label: 'Todos', count: counts.all },
    { value: 'active', label: 'Activos', count: counts.active },
    { value: 'inactive', label: 'Inactivos', count: counts.inactive },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1 sm:max-w-[340px]">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden
        />
        <Input
          type="search"
          value={filters.query}
          onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
          placeholder="Buscar por nombre o IP"
          aria-label="Buscar por nombre o IP"
          // [&::-webkit-search-cancel-button]: el botón propio de borrar sustituye al del navegador
          className="pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
        />
        {filters.query !== '' && (
          <button
            type="button"
            onClick={() => onFiltersChange({ ...filters, query: '' })}
            aria-label="Borrar búsqueda"
            title="Borrar búsqueda"
            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        )}
      </div>

      <SegmentedControl
        value={filters.status}
        options={statusOptions}
        onChange={(status) => onFiltersChange({ ...filters, status })}
        aria-label="Filtrar por estado"
      />

      <Select value={filters.owner} onValueChange={(owner) => onFiltersChange({ ...filters, owner })}>
        <SelectTrigger className="h-9 w-full rounded-lg bg-surface sm:w-[180px]" aria-label="Filtrar por dueño">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los dueños</SelectItem>
          {owners.map((owner) => (
            <SelectItem key={owner.id} value={String(owner.id)}>
              {owner.name}
            </SelectItem>
          ))}
          <SelectItem value="none">Sin asignar</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sort} onValueChange={(value) => onSortChange(SORT_OPTIONS.find((option) => option.value === value)?.value ?? 'name')}>
        <SelectTrigger className="h-9 w-full rounded-lg bg-surface sm:w-[210px]" aria-label="Ordenar por">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

import { ChevronDown, ChevronRight, CircleAlert, ClipboardList } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { toApiError } from '@/shared/api/client'
import { Badge } from '@/shared/components/ui/badge'
import { EmptyState } from '@/shared/components/EmptyState'
import { FilterBar } from '@/shared/components/FilterBar'
import { Pagination } from '@/shared/components/Pagination'
import { DataTable, type Column, type SortState } from '@/shared/components/Table'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { formatShortDate } from '@/shared/lib/formatDate'

import { useAuditLogs, type AuditLogsFilters } from '../api'
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES, type AuditLogEntry } from '../types'
import { AuditRowDetail } from './AuditRowDetail'

export function AdminAuditLogsPage() {
  // CLAUDE.md §7.10: filtros y página viven en los query params de la URL
  const [searchParams, setSearchParams] = useSearchParams()
  const filters: AuditLogsFilters = {
    userName: searchParams.get('userName') ?? '',
    action: searchParams.get('action'),
    resourceType: searchParams.get('resourceType'),
    from: searchParams.get('from'),
    to: searchParams.get('to'),
  }
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)

  const updateParams = (patch: Record<string, string | null>) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(patch)) {
          if (value === null || value === '') next.delete(key)
          else next.set(key, value)
        }
        return next
      },
      { replace: true },
    )
  }

  // Búsqueda de usuario con debounce (§11), volcada a la URL
  const [userNameInput, setUserNameInput] = useState(filters.userName)
  const debouncedUserName = useDebounce(userNameInput)
  const urlUserName = searchParams.get('userName') ?? ''
  useEffect(() => {
    if (debouncedUserName === urlUserName) return
    updateParams({ userName: debouncedUserName, page: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateParams es estable a efectos prácticos
  }, [debouncedUserName, urlUserName])

  const [sort, setSort] = useState<SortState | undefined>()
  const onSort = (key: string) => {
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )
  }

  const query = useAuditLogs(filters, page)

  // Orden en cliente sobre la página cargada — el backend no admite parámetros
  // de orden (mismo criterio que Usuarios/Archivos/Logs, §6.6)
  const rows = useMemo(() => {
    const items = [...(query.data?.items ?? [])]
    if (!sort) return items
    const sign = sort.direction === 'asc' ? 1 : -1
    const collator = new Intl.Collator('es', { sensitivity: 'base' })
    items.sort((a, b) => {
      if (sort.key === 'username') return sign * collator.compare(a.username, b.username)
      if (sort.key === 'action') return sign * a.action.localeCompare(b.action)
      return sign * a.timeStamp.localeCompare(b.timeStamp)
    })
    return items
  }, [query.data, sort])

  const [expandedId, setExpandedId] = useState<number | null>(null)

  const activeFilterCount = [filters.userName, filters.action, filters.resourceType, filters.from, filters.to].filter(
    (value) => value !== null && value !== '',
  ).length

  const clearFilters = () => {
    setUserNameInput('')
    setSearchParams({}, { replace: true })
  }

  const columns: Array<Column<AuditLogEntry>> = [
    {
      key: 'expand',
      header: '',
      className: 'w-8',
      cell: (entry) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          // CLAUDE.md §10/§11: icono visual pequeño (tabla densa, §6.6), área táctil ~44px
          className="relative h-7 w-7 text-text-faint after:absolute after:-inset-2 after:content-[''] hover:text-text-primary"
          aria-label={expandedId === entry.id ? 'Contraer detalle' : 'Ver detalle completo'}
          aria-expanded={expandedId === entry.id}
          onClick={() => setExpandedId((current) => (current === entry.id ? null : entry.id))}
        >
          {expandedId === entry.id ? <ChevronDown /> : <ChevronRight />}
        </Button>
      ),
    },
    {
      key: 'timeStamp',
      header: 'Fecha',
      sortable: true,
      cell: (entry) => <span className="text-text-muted-2">{formatShortDate(entry.timeStamp)}</span>,
    },
    {
      key: 'username',
      header: 'Usuario',
      sortable: true,
      cell: (entry) => <span className="font-medium text-text-primary">{entry.username}</span>,
    },
    {
      key: 'action',
      header: 'Acción',
      sortable: true,
      cell: (entry) => <Badge variant="secondary">{entry.action}</Badge>,
    },
    {
      key: 'resourceType',
      header: 'Recurso',
      className: 'hidden md:table-cell',
      cell: (entry) => (
        <span className="text-text-secondary">
          {entry.resourceType ?? '—'}
          {entry.resourceName ? ` · ${entry.resourceName}` : ''}
        </span>
      ),
    },
    {
      key: 'ipAddress',
      header: 'IP',
      className: 'hidden lg:table-cell',
      cell: (entry) => <span className="font-mono text-xs text-text-muted-2">{entry.ipAddress ?? '—'}</span>,
    },
  ]

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-text-primary">Auditoría</h1>
      </div>

      <FilterBar
        activeFilterCount={activeFilterCount}
        onClear={clearFilters}
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
                onChange={(event) => updateParams({ from: event.target.value, page: null })}
              />
              <Label htmlFor="filter-to" className="text-xs text-text-secondary">
                Hasta
              </Label>
              <Input
                id="filter-to"
                type="date"
                value={filters.to ?? ''}
                onChange={(event) => updateParams({ to: event.target.value, page: null })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="filter-action" className="text-xs text-text-secondary">
                Acción
              </Label>
              <Select
                value={filters.action ?? 'all'}
                onValueChange={(value) => updateParams({ action: value === 'all' ? null : value, page: null })}
              >
                <SelectTrigger id="filter-action" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {AUDIT_ACTIONS.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="filter-resource-type" className="text-xs text-text-secondary">
                Tipo de recurso
              </Label>
              <Select
                value={filters.resourceType ?? 'all'}
                onValueChange={(value) =>
                  updateParams({ resourceType: value === 'all' ? null : value, page: null })
                }
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
        {/* §6.6: búsqueda de usuario siempre visible */}
        <Input
          value={userNameInput}
          onChange={(event) => setUserNameInput(event.target.value)}
          placeholder="Buscar por usuario"
          className="h-9 w-full sm:w-56"
          aria-label="Buscar por usuario"
        />
      </FilterBar>

      {query.isPending ? (
        // §6.10: skeleton con forma de filas de tabla
        <div className="flex flex-col gap-1 rounded-xl border border-border p-3" aria-hidden>
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 px-2 py-1.5">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
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
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Sin resultados"
          description={
            activeFilterCount > 0
              ? 'Ningún registro de auditoría coincide con los filtros activos.'
              : 'Todavía no hay registros de auditoría.'
          }
          action={
            activeFilterCount > 0 ? (
              <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(entry) => entry.id}
              sort={sort}
              onSort={onSort}
              expandedRowKey={expandedId}
              renderExpanded={(entry) => <AuditRowDetail entry={entry} />}
            />
          </div>
          <Pagination
            page={page}
            totalPages={query.data.totalPages}
            totalCount={query.data.totalCount}
            onPageChange={(next) => updateParams({ page: String(next) })}
          />
        </>
      )}
    </div>
  )
}

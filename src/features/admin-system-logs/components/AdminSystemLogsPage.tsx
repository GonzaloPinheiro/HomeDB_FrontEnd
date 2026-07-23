import { ChevronDown, ChevronRight, CircleAlert, ScrollText } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { toApiError } from '@/shared/api/client'
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

import { useLogs, type LogsFilters } from '../api'
import { LOG_LEVELS, type LogEntry } from '../types'
import { LevelBadge } from './LevelBadge'
import { LogRowDetail } from './LogRowDetail'
import { LogsHealthSummary } from './LogsHealthSummary'

export function AdminSystemLogsPage() {
  // CLAUDE.md §7.10: filtros y página viven en los query params de la URL
  const [searchParams, setSearchParams] = useSearchParams()
  const filters: LogsFilters = {
    level: searchParams.get('level'),
    operation: searchParams.get('operation') ?? '',
    from: searchParams.get('from'),
    to: searchParams.get('to'),
    correlationId: searchParams.get('correlationId'),
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

  // Búsqueda de "Operación" con debounce (§11), volcada a la URL
  const [operationInput, setOperationInput] = useState(filters.operation)
  const debouncedOperation = useDebounce(operationInput)
  const urlOperation = searchParams.get('operation') ?? ''
  useEffect(() => {
    if (debouncedOperation === urlOperation) return
    updateParams({ operation: debouncedOperation, page: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateParams es estable a efectos prácticos
  }, [debouncedOperation, urlOperation])

  const [sort, setSort] = useState<SortState | undefined>()
  const onSort = (key: string) => {
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )
  }

  const query = useLogs(filters, page)

  // Orden en cliente sobre la página cargada — el backend no admite parámetros
  // de orden (mismo criterio que Usuarios/Archivos, §6.6)
  const rows = useMemo(() => {
    const items = [...(query.data?.items ?? [])]
    if (!sort) return items
    const sign = sort.direction === 'asc' ? 1 : -1
    items.sort((a, b) => {
      if (sort.key === 'operation') return sign * a.operation.localeCompare(b.operation)
      if (sort.key === 'durationMs') return sign * (a.durationMs - b.durationMs)
      return sign * a.timeStamp.localeCompare(b.timeStamp)
    })
    return items
  }, [query.data, sort])

  const [expandedId, setExpandedId] = useState<number | null>(null)

  const activeFilterCount = [filters.level, filters.operation, filters.from, filters.to, filters.correlationId].filter(
    (value) => value !== null && value !== '',
  ).length

  const clearFilters = () => {
    setOperationInput('')
    setSearchParams({}, { replace: true })
  }

  const columns: Array<Column<LogEntry>> = [
    {
      key: 'expand',
      header: '',
      className: 'w-8',
      cell: (log) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          // CLAUDE.md §10/§11: icono visual pequeño (tabla densa, §6.6), área táctil ~44px
          className="relative h-7 w-7 text-text-faint after:absolute after:-inset-2 after:content-[''] hover:text-text-primary"
          aria-label={expandedId === log.id ? 'Contraer detalle' : 'Ver detalle completo'}
          aria-expanded={expandedId === log.id}
          onClick={() => setExpandedId((current) => (current === log.id ? null : log.id))}
        >
          {expandedId === log.id ? <ChevronDown /> : <ChevronRight />}
        </Button>
      ),
    },
    {
      key: 'level',
      header: 'Nivel',
      cell: (log) => <LevelBadge level={log.level} />,
    },
    {
      key: 'timeStamp',
      header: 'Fecha',
      sortable: true,
      cell: (log) => <span className="text-text-muted-2">{formatShortDate(log.timeStamp)}</span>,
    },
    {
      key: 'operation',
      header: 'Operación',
      sortable: true,
      // §6.6: identificador técnico en fuente monoespaciada, distinto de texto normal
      cell: (log) => <span className="font-mono text-xs text-text-primary">{log.operation}</span>,
    },
    {
      key: 'message',
      header: 'Mensaje',
      className: 'hidden md:table-cell',
      cell: (log) => <span className="line-clamp-1 text-text-secondary">{log.message || '—'}</span>,
    },
    {
      key: 'source',
      header: 'Origen',
      className: 'hidden lg:table-cell',
      cell: (log) => <span className="text-text-secondary">{log.source || '—'}</span>,
    },
    {
      key: 'durationMs',
      header: 'Duración',
      sortable: true,
      className: 'hidden sm:table-cell',
      cell: (log) => <span className="tabular-nums text-text-muted-2">{log.durationMs} ms</span>,
    },
  ]

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-text-primary">Registros</h1>
        <LogsHealthSummary />
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
              <Label htmlFor="filter-correlation" className="text-xs text-text-secondary">
                CorrelationId
              </Label>
              <Input
                id="filter-correlation"
                value={filters.correlationId ?? ''}
                onChange={(event) => updateParams({ correlationId: event.target.value, page: null })}
                placeholder="Id de correlación"
                className="font-mono text-xs"
              />
            </div>
          </>
        }
      >
        {/* §6.6: select de nivel + búsqueda de Operación siempre visibles */}
        <Select
          value={filters.level ?? 'all'}
          onValueChange={(value) => updateParams({ level: value === 'all' ? null : value, page: null })}
        >
          <SelectTrigger className="h-9 w-36">
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
          value={operationInput}
          onChange={(event) => setOperationInput(event.target.value)}
          placeholder="Buscar por operación"
          className="h-9 w-full sm:w-56"
          aria-label="Buscar por operación"
        />
      </FilterBar>

      {query.isPending ? (
        // §6.10: skeleton con forma de filas de tabla
        <div className="flex flex-col gap-1 rounded-xl border border-border p-3" aria-hidden>
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 px-2 py-1.5">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-4 w-16" />
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
          icon={ScrollText}
          title="Sin resultados"
          description={
            activeFilterCount > 0
              ? 'Ningún registro coincide con los filtros activos.'
              : 'Todavía no hay registros.'
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
              rowKey={(log) => log.id}
              sort={sort}
              onSort={onSort}
              expandedRowKey={expandedId}
              renderExpanded={(log) => <LogRowDetail log={log} />}
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

import { ChevronDown, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'

import { DataTable, type Column, type SortState } from '@/shared/components/Table'
import { Button } from '@/shared/components/ui/button'
import { formatDateTime, formatShortDateTime } from '@/shared/lib/formatDate'
import { formatMillis } from '@/shared/lib/formatDuration'

import type { LogEntry } from '../types'
import { LevelBadge } from './LevelBadge'
import { LogRowDetail } from './LogRowDetail'

type LogsTableProps = {
  rows: LogEntry[]
  onShowRequest: (correlationId: string) => void
}

// Orden en cliente sobre la página cargada — el backend no admite parámetros de orden y devuelve siempre
// lo más reciente primero (mismo criterio que Usuarios/Archivos, §6.6)
function sortRows(rows: LogEntry[], sort: SortState | undefined): LogEntry[] {
  if (!sort) return rows
  const sign = sort.direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (sort.key === 'operation') return sign * a.operation.localeCompare(b.operation)
    if (sort.key === 'durationMs') return sign * (a.durationMs - b.durationMs)
    return sign * a.timeStamp.localeCompare(b.timeStamp)
  })
}

export function LogsTable({ rows, onShowRequest }: LogsTableProps) {
  const [sort, setSort] = useState<SortState | undefined>()
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const onSort = (key: string) => {
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )
  }

  const sortedRows = useMemo(() => sortRows(rows, sort), [rows, sort])

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
      // Con hora: en un registro de eventos "12 jul" sin más no dice cuándo pasó. Completa (con segundos) en el tooltip
      cell: (log) => (
        <span className="whitespace-nowrap text-text-muted-2" title={formatDateTime(log.timeStamp)}>
          {formatShortDateTime(log.timeStamp)}
        </span>
      ),
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
      // Abreviada para comparar de un vistazo; el valor exacto en ms está en el detalle de la fila
      cell: (log) => <span className="tabular-nums text-text-muted-2">{formatMillis(log.durationMs)}</span>,
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={sortedRows}
      rowKey={(log) => log.id}
      sort={sort}
      onSort={onSort}
      expandedRowKey={expandedId}
      renderExpanded={(log) => <LogRowDetail log={log} onShowRequest={onShowRequest} />}
    />
  )
}

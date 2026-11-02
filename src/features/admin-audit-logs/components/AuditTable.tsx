import { ChevronDown, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'

import { DataTable, type Column, type SortState } from '@/shared/components/Table'
import { Button } from '@/shared/components/ui/button'
import { formatDateTime, formatShortDateTime } from '@/shared/lib/formatDate'

import { actionLabel } from '../actions'
import type { AuditLogEntry } from '../types'
import { ActionBadge } from './ActionBadge'
import { AuditRowDetail } from './AuditRowDetail'

type AuditTableProps = {
  rows: AuditLogEntry[]
  /** Pulsar el usuario de una fila: filtra por ese usuario exacto. */
  onSelectUser: (entry: AuditLogEntry) => void
  /** Pulsar la acción de una fila: filtra por esa acción. */
  onSelectAction: (entry: AuditLogEntry) => void
}

// Orden en cliente sobre la página cargada — el backend no admite parámetros de orden y devuelve siempre
// lo más reciente primero (mismo criterio que Usuarios/Archivos/Logs, §6.6). La acción se ordena por su
// etiqueta legible, que es lo que se ve.
function sortRows(rows: AuditLogEntry[], sort: SortState | undefined): AuditLogEntry[] {
  if (!sort) return rows
  const sign = sort.direction === 'asc' ? 1 : -1
  const collator = new Intl.Collator('es', { sensitivity: 'base' })
  return [...rows].sort((a, b) => {
    if (sort.key === 'username') return sign * collator.compare(a.username, b.username)
    if (sort.key === 'action') return sign * collator.compare(actionLabel(a.action), actionLabel(b.action))
    return sign * a.timeStamp.localeCompare(b.timeStamp)
  })
}

export function AuditTable({ rows, onSelectUser, onSelectAction }: AuditTableProps) {
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
      // Con hora, como en Registros (§6.23); completa (con segundos) en el tooltip
      cell: (entry) => (
        <span className="whitespace-nowrap text-text-muted-2" title={formatDateTime(entry.timeStamp)}>
          {formatShortDateTime(entry.timeStamp)}
        </span>
      ),
    },
    {
      key: 'username',
      header: 'Usuario',
      sortable: true,
      cell: (entry) => (
        <button
          type="button"
          onClick={() => onSelectUser(entry)}
          // El nombre accesible dice QUÉ hace el botón y contiene el texto visible (WCAG 2.5.3)
          aria-label={`Ver solo la actividad de ${entry.username}`}
          title={`Ver solo la actividad de ${entry.username}`}
          className="rounded font-medium text-text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {entry.username}
        </button>
      ),
    },
    {
      key: 'action',
      header: 'Acción',
      sortable: true,
      cell: (entry) => <ActionBadge action={entry.action} onSelect={() => onSelectAction(entry)} />,
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
    <DataTable
      columns={columns}
      rows={sortedRows}
      rowKey={(entry) => entry.id}
      sort={sort}
      onSort={onSort}
      expandedRowKey={expandedId}
      renderExpanded={(entry) => <AuditRowDetail entry={entry} />}
    />
  )
}

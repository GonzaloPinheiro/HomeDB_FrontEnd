import { ArrowDown, ArrowUp } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  Table as UiTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'
import { cn } from '@/shared/lib/utils'

export type SortState = { key: string; direction: 'asc' | 'desc' }

export type Column<T> = {
  key: string
  header: string
  /** Cada pantalla decide qué columnas suyas son ordenables. */
  sortable?: boolean
  className?: string
  cell: (row: T) => ReactNode
}

type DataTableProps<T> = {
  columns: Array<Column<T>>
  rows: T[]
  rowKey: (row: T) => string | number
  sort?: SortState
  /** Clic ordena; clic en la columna activa invierte (mismo patrón que Archivos, §6.3/§6.6). */
  onSort?: (key: string) => void
}

// CLAUDE.md §6.6: tabla compartida de las pantallas de Admin — más densa que la
// lista de archivos (menos padding vertical), cabeceras ordenables con flecha.
// Genérica para reutilizarse en Logs y Auditoría (Fase 5) sin cambios.
export function DataTable<T>({ columns, rows, rowKey, sort, onSort }: DataTableProps<T>) {
  return (
    <UiTable>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((column) => {
            const isActive = sort?.key === column.key
            const Arrow = sort?.direction === 'asc' ? ArrowUp : ArrowDown
            return (
              <TableHead key={column.key} className={cn('h-9 bg-surface', column.className)}>
                {column.sortable && onSort ? (
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(
                      'flex items-center gap-1 text-xs font-medium uppercase tracking-wide',
                      isActive ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary',
                    )}
                  >
                    {column.header}
                    {isActive && <Arrow className="h-3 w-3" aria-hidden />}
                  </button>
                ) : (
                  <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                    {column.header}
                  </span>
                )}
              </TableHead>
            )
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={rowKey(row)}>
            {columns.map((column) => (
              // §6.6: py-2 (denso), frente al py-2.5 de la lista de archivos
              <TableCell key={column.key} className={cn('py-2', column.className)}>
                {column.cell(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </UiTable>
  )
}

import type { UseQueryResult } from '@tanstack/react-query'
import { CircleAlert, Download } from 'lucide-react'

import { toApiError } from '@/shared/api/client'
import { EmptyState } from '@/shared/components/EmptyState'
import { FloatCard } from '@/shared/components/FloatCard'
import { SelectCheckbox } from '@/shared/components/SelectCheckbox'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

import { WIDE_ROW_GRID, type ListLayout } from '../layout'
import type { Torrent } from '../types'
import { TorrentListSkeleton } from './TorrentListSkeleton'
import { TorrentRow } from './TorrentRow'

type TorrentListProps = {
  query: UseQueryResult<Torrent[]>
  layout: ListLayout
  selectedId: number | null
  onSelect: (id: number) => void
  className?: string
}

// Cabecera de columnas: solo en el layout `wide`; en `compact` no hay columnas.
function ColumnHeaders() {
  return (
    <div
      className={cn(
        WIDE_ROW_GRID,
        'border-b border-border-light px-3 pb-2 text-xs font-medium uppercase tracking-wide text-text-muted',
      )}
    >
      {/* PENDIENTE (CLAUDE.md §6.19): "seleccionar todo" es solo visual, como las casillas de fila */}
      <SelectCheckbox checked={false} onToggle={() => undefined} label="Seleccionar todos los torrents" />
      <span>Nombre</span>
      <span>Estado</span>
      <span>Progreso</span>
      <span className="text-right">Acciones</span>
    </div>
  )
}

// CLAUDE.md §6.19: tarjeta con la lista de torrents y sus estados de carga, error
// y vacío (§6.9, §6.10). El error se decide con `data === undefined` y no con
// `isError` (§7.1): un refetch fallido no debe tapar una lista que ya se tiene.
export function TorrentList({ query, layout, selectedId, onSelect, className }: TorrentListProps) {
  const torrents = query.data

  return (
    <FloatCard className={cn('p-2', className)}>
      {query.isPending ? (
        <TorrentListSkeleton />
      ) : torrents === undefined ? (
        <EmptyState
          icon={CircleAlert}
          title="No se pudieron cargar los torrents"
          description={toApiError(query.error).message}
          action={
            <Button variant="outline" onClick={() => void query.refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : torrents.length === 0 ? (
        <EmptyState
          icon={Download}
          title="Todavía no hay torrents"
          description="Añade un torrent o un enlace magnet y aparecerá aquí con su progreso."
        />
      ) : (
        <>
          {layout === 'wide' && <ColumnHeaders />}
          <ul className="flex flex-col gap-0.5 pt-1">
            {torrents.map((torrent) => (
              <TorrentRow
                key={torrent.id}
                torrent={torrent}
                layout={layout}
                selected={torrent.id === selectedId}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </>
      )}
    </FloatCard>
  )
}

import { ChevronDown } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

import { CATEGORY_LABELS } from '../labels'
import { TORRENT_CATEGORIES, type TorrentCategory } from '../types'

export type CategoryFilter = TorrentCategory | 'all'

type TorrentsToolbarProps = {
  /** Cuántos torrents hay por categoría; `undefined` mientras carga (los contadores se ocultan). */
  counts: Record<TorrentCategory, number> | undefined
  total: number | undefined
  active: CategoryFilter
}

// CLAUDE.md §6.19: categorías como filtro principal (chips con contador) y, a la
// derecha, agrupar y ordenar. En móvil los chips no caben en una línea: la tira
// hace scroll horizontal en vez de partirse en varias filas.
// PENDIENTE (CLAUDE.md §6.19): maqueta — `active` es fijo y los botones no hacen
// nada. Con backend, `active` pasará a ser estado de la pantalla (o query param,
// §7.10) con su `onChange`, y "Agrupar"/"Recientes" abrirán sus menús.
export function TorrentsToolbar({ counts, total, active }: TorrentsToolbarProps) {
  const chips: ReadonlyArray<{ value: CategoryFilter; label: string; count: number | undefined }> = [
    { value: 'all', label: 'Todas', count: total },
    ...TORRENT_CATEGORIES.map((category) => ({
      value: category,
      label: CATEGORY_LABELS[category],
      count: counts?.[category],
    })),
  ]

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div
        role="group"
        aria-label="Filtrar por categoría"
        className="max-w-full overflow-x-auto rounded-lg bg-surface p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-max gap-1">
          {chips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              aria-pressed={chip.value === active}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                chip.value === active
                  ? 'bg-card text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {chip.label}
              {chip.count !== undefined && <span className="text-xs font-normal text-text-muted">{chip.count}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          Agrupar: Estado
          <ChevronDown aria-hidden />
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          Recientes
          <ChevronDown aria-hidden />
        </Button>
      </div>
    </div>
  )
}

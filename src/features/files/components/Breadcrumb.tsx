import { useDroppable } from '@dnd-kit/core'
import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'

import { cn } from '@/shared/lib/utils'

import type { Crumb } from '../types'

type BreadcrumbProps = {
  crumbs: Crumb[]
  /** Navega al índice indicado del trail (0 = raíz). */
  onNavigate: (index: number) => void
}

type Segment = { crumb: Crumb; index: number } | { ellipsis: true }

// A partir de ~4 niveles se colapsan los intermedios en "…": queda visible el
// primero y los dos últimos.
function toSegments(crumbs: Crumb[]): Segment[] {
  if (crumbs.length <= 4) {
    return crumbs.map((crumb, index) => ({ crumb, index }))
  }
  return [
    { crumb: crumbs[0], index: 0 },
    { ellipsis: true },
    { crumb: crumbs[crumbs.length - 2], index: crumbs.length - 2 },
    { crumb: crumbs[crumbs.length - 1], index: crumbs.length - 1 },
  ]
}

// CLAUDE.md §6.3: cada segmento del breadcrumb (salvo el actual) es destino de
// drop para mover un archivo a esa carpeta ancestro; mantener el arrastre
// encima ~800ms navega ahí (useDwell, gestionado por la página).
function BreadcrumbSegment({
  crumb,
  index,
  isCurrent,
  onNavigate,
}: {
  crumb: Crumb
  index: number
  isCurrent: boolean
  onNavigate: (index: number) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `crumb-${index}`,
    disabled: isCurrent, // soltar sobre la carpeta actual no es un movimiento
    data: { type: 'crumb', folderId: crumb.id, index },
  })

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onNavigate(index)}
      disabled={isCurrent}
      className={cn(
        'max-w-40 truncate rounded px-1 py-0.5',
        isCurrent
          ? 'font-medium text-text-primary'
          : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary',
        isOver && 'bg-accent-tint-bg text-accent-tint-text ring-1 ring-accent',
      )}
    >
      {crumb.name}
    </button>
  )
}

export function Breadcrumb({ crumbs, onNavigate }: BreadcrumbProps) {
  const segments = toSegments(crumbs)
  const lastIndex = crumbs.length - 1

  return (
    <nav aria-label="Ruta de carpetas" className="flex min-w-0 items-center gap-1 text-sm">
      {segments.map((segment, position) => (
        <Fragment key={'ellipsis' in segment ? `ellipsis-${position}` : segment.index}>
          {position > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-faint" aria-hidden />}
          {'ellipsis' in segment ? (
            <span className="shrink-0 text-text-muted">…</span>
          ) : (
            <BreadcrumbSegment
              crumb={segment.crumb}
              index={segment.index}
              isCurrent={segment.index === lastIndex}
              onNavigate={onNavigate}
            />
          )}
        </Fragment>
      ))}
    </nav>
  )
}

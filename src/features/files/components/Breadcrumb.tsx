import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'

import { cn } from '@/shared/lib/utils'

export type Crumb = {
  id: number | null
  name: string
}

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
            <button
              type="button"
              onClick={() => onNavigate(segment.index)}
              disabled={segment.index === lastIndex}
              className={cn(
                'max-w-40 truncate rounded px-1 py-0.5',
                segment.index === lastIndex
                  ? 'font-medium text-text-primary'
                  : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary',
              )}
            >
              {segment.crumb.name}
            </button>
          )}
        </Fragment>
      ))}
    </nav>
  )
}

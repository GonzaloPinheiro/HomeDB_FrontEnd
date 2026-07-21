import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'

type PaginationProps = {
  page: number
  totalPages: number
  totalCount: number
  onPageChange: (page: number) => void
}

// CLAUDE.md §6.6: paginación compartida de las tablas de Admin. La página
// activa vive en los query params de la URL (§7.10) — el caller la sincroniza.
export function Pagination({ page, totalPages, totalCount, onPageChange }: PaginationProps) {
  if (totalPages <= 1 && totalCount === 0) return null

  return (
    <div className="flex items-center justify-between gap-2 text-sm text-text-secondary">
      <span>
        {totalCount} {totalCount === 1 ? 'resultado' : 'resultados'}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft />
        </Button>
        <span className="tabular-nums">
          {page} / {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}

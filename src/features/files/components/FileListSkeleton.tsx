import { Skeleton } from '@/shared/components/ui/skeleton'

import { GRID_CLASSES } from './explorerLayout'

// CLAUDE.md §6.10: skeleton con la misma forma que las filas reales de la
// lista, no un spinner genérico — la pantalla no salta al llegar los datos.
export function FileListSkeleton() {
  return (
    <div className="flex flex-col gap-1 py-2" aria-hidden>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-16 sm:block" />
          <Skeleton className="hidden h-4 w-20 md:block" />
          <Skeleton className="h-4 w-4" />
        </div>
      ))}
    </div>
  )
}

// §6.3b: lo mismo para la vista de miniaturas — misma rejilla y misma forma de
// tarjeta (zona cuadrada + dos líneas de texto) que FileCard.
export function FileGridSkeleton() {
  return (
    <div className={GRID_CLASSES} aria-hidden>
      {Array.from({ length: 12 }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-xl p-2">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <div className="flex flex-col gap-1.5 px-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

import { Skeleton } from '@/shared/components/ui/skeleton'

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

import { Skeleton } from '@/shared/components/ui/skeleton'

// CLAUDE.md §6.10: skeleton con la forma de las filas reales (casilla, nombre con
// su línea de detalle, estado y progreso), no un spinner genérico.
export function TorrentListSkeleton() {
  return (
    <div className="flex flex-col gap-1 py-1" aria-hidden>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-lg px-3 py-3">
          <Skeleton className="h-5 w-5 shrink-0 rounded" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="hidden h-6 w-28 sm:block" />
          <Skeleton className="hidden h-6 w-32 md:block" />
          <Skeleton className="h-8 w-16 shrink-0" />
        </div>
      ))}
    </div>
  )
}

import { Skeleton } from '@/shared/components/ui/skeleton'

// CLAUDE.md §6.10: skeleton con la forma del contenido real (barra de filtros y tarjetas), para
// que la pantalla no salte cuando llegan los datos.
export function VpnSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Skeleton className="h-9 w-full max-w-[560px] rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(270px,1fr))]">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-[204px] rounded-[14px]" />
        ))}
      </div>
    </div>
  )
}

import { Skeleton } from '@/shared/components/ui/skeleton'

// CLAUDE.md §6.10: skeleton con la forma del contenido real (tarjeta de estado, cifras,
// gráfico y tarjetas de abajo), para que la pantalla no salte cuando llegan los datos.
export function AdBlockerSkeleton() {
  return (
    <div className="flex flex-col gap-[22px]" aria-hidden>
      <Skeleton className="h-[188px] rounded-[14px] sm:h-[150px]" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-[118px] rounded-[14px]" />
        ))}
      </div>
      <Skeleton className="h-[338px] rounded-[14px]" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Skeleton className="h-[280px] rounded-[14px]" />
        <Skeleton className="h-[280px] rounded-[14px]" />
      </div>
    </div>
  )
}

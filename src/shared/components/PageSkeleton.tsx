import { Skeleton } from '@/shared/components/ui/skeleton'

// CLAUDE.md §6.10: skeleton con la forma del contenido (cabecera + bloques),
// nunca un spinner genérico. Se usa mientras se resuelve la sesión o carga una
// página lazy, para evitar parpadeos en blanco.
export function PageSkeleton() {
  return (
    <div className="flex min-h-full flex-col gap-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="mt-4 flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}

import { useIsFetching, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

// Botón "Refrescar" de una pantalla cuyas consultas cuelgan de una misma clave raíz: la invalida (y por
// tanto vuelve a pedir todo lo que está en pantalla, incluidas las consultas con `staleTime`). Gira y se
// desactiva mientras alguna sigue en vuelo.
export function QueryRefreshButton({ queryKey }: { queryKey: QueryKey }) {
  const queryClient = useQueryClient()
  const isFetching = useIsFetching({ queryKey }) > 0

  return (
    <Button
      variant="outline"
      className="gap-2"
      disabled={isFetching}
      onClick={() => void queryClient.invalidateQueries({ queryKey })}
    >
      <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} aria-hidden />
      Refrescar
    </Button>
  )
}

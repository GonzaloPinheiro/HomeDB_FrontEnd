import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

import { logsKeys } from '../api'

// CLAUDE.md §6.23: mismo ritmo de cabecera que Inicio, Monitor y AdGuard (§6.18, §6.13, §6.21): línea
// secundaria + título grande. "Refrescar" vuelve a pedir TODO lo de la pantalla (cifras, tarjetas de
// análisis y tabla): cuelgan de la misma clave raíz, y las tarjetas de análisis tienen staleTime, así que
// sin este botón no se repetirían solas.
export function LogsHeader() {
  const queryClient = useQueryClient()
  const isFetching = useIsFetching({ queryKey: logsKeys.all }) > 0

  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="mb-1.5 text-[13px] text-text-secondary">Diagnóstico del servidor</p>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-[30px]">Registros</h1>
      </div>
      <Button
        variant="outline"
        className="gap-2"
        disabled={isFetching}
        onClick={() => void queryClient.invalidateQueries({ queryKey: logsKeys.all })}
      >
        <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} aria-hidden />
        Refrescar
      </Button>
    </header>
  )
}

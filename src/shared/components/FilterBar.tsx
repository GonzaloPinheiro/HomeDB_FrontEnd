import { ListFilter } from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

type FilterBarProps = {
  /** 1-2 filtros de uso frecuente, siempre visibles (§6.6). */
  children: ReactNode
  /** Resto de filtros, dentro del panel del botón "Filtros". */
  panel?: ReactNode
  /** Número de filtros activos — se muestra como contador en el botón. */
  activeFilterCount: number
  /** CLAUDE.md §6.6: el texto estándar es "Limpiar filtros", sin variantes. */
  onClear: () => void
}

// CLAUDE.md §6.6/§7.10: patrón compartido de filtros de las tablas de Admin.
// El ESTADO de los filtros vive en los query params de la URL (useSearchParams,
// lo gestiona cada pantalla) — este componente es solo la presentación.
export function FilterBar({ children, panel, activeFilterCount, onClear }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      {panel ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <ListFilter />
              Filtros
              {activeFilterCount > 0 && (
                <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="flex w-72 flex-col gap-3 rounded-xl bg-card">
            {panel}
          </PopoverContent>
        </Popover>
      ) : null}
      {activeFilterCount > 0 && (
        <Button variant="ghost" onClick={onClear}>
          Limpiar filtros
        </Button>
      )}
    </div>
  )
}

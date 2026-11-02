import { FloatCard } from '@/shared/components/FloatCard'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatInteger } from '@/shared/lib/formatNumber'
import { cn } from '@/shared/lib/utils'

import { useFilterLists } from '../api'
import {
  describeListsSummary,
  formatListAge,
  getListAgeHours,
  isListStale,
  summarizeLists,
} from '../presentation'
import { useNow } from '@/shared/hooks/useNow'

// CLAUDE.md §6.21: salud de las listas de bloqueo, solo lectura (altas y bajas se gestionan
// en el panel de AdGuard). Una lista sin actualizar en más de 7 días se resalta (Warning, §6.7).
export function FilterListsCard() {
  const lists = useFilterLists()
  const now = useNow(false)
  const data = lists.data

  return (
    <FloatCard className="min-w-0 p-5 sm:px-[22px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3.5 gap-y-1.5">
        <h2 className="text-[15px] font-semibold text-text-primary">Listas de bloqueo</h2>
        {data !== undefined && (
          <span className="text-xs text-text-secondary">{describeListsSummary(summarizeLists(data, now))}</span>
        )}
      </div>
      <p className="mt-[3px] text-xs text-text-secondary">Solo lectura. Se gestionan en el panel de AdGuard.</p>

      <div className="mt-3 flex flex-col gap-0.5" aria-busy={lists.isPending}>
        {lists.isPending ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="my-0.5 h-9 w-full" />)
        ) : data === undefined ? (
          <p className="py-2.5 text-sm text-text-muted">No se pudo cargar el estado de las listas.</p>
        ) : (
          data.map((list) => {
            const stale = isListStale(list, now)
            return (
              <div
                key={list.name}
                // En pantallas estrechas la fila se parte en dos líneas (nombre / datos); desde `sm`
                // son cuatro columnas fijas para que cifras y fechas queden alineadas entre filas
                className={cn(
                  'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[9px] px-2.5 py-[9px]',
                  'sm:grid sm:grid-cols-[minmax(0,1fr)_auto_104px_168px]',
                  stale && 'bg-warning-bg',
                )}
              >
                <span
                  className={cn(
                    'min-w-0 flex-[1_1_100%] truncate text-[13px] font-semibold sm:flex-none',
                    // Sobre el fondo de aviso (crema en AMBOS temas, §6.1) el texto principal del tema
                    // oscuro sería casi blanco sobre crema: ahí se usa el color de aviso
                    stale ? 'text-warning-text' : list.enabled ? 'text-text-primary' : 'text-text-secondary',
                  )}
                  title={list.name}
                >
                  {list.name}
                </span>
                <span
                  className={cn(
                    'justify-self-start rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    list.enabled
                      ? 'bg-positive-bg text-positive-text'
                      : stale
                        ? 'border border-warning-text text-warning-text'
                        : 'border border-border-light bg-surface text-text-secondary',
                  )}
                >
                  {list.enabled ? 'Activa' : 'Inactiva'}
                </span>
                <span
                  className={cn(
                    'whitespace-nowrap font-mono text-xs sm:text-right',
                    stale ? 'text-warning-text' : 'text-text-secondary',
                  )}
                >
                  {formatInteger(list.ruleCount)} reglas
                </span>
                <span
                  className={cn(
                    'ml-auto whitespace-nowrap text-xs sm:ml-0 sm:text-right',
                    stale ? 'font-semibold text-warning-text' : 'text-text-secondary',
                  )}
                >
                  {stale ? 'Sin actualizar · ' : ''}
                  {formatListAge(getListAgeHours(list.lastUpdated, now))}
                </span>
              </div>
            )
          })
        )}
      </div>
    </FloatCard>
  )
}

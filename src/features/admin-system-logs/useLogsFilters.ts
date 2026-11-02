import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useDebouncedField } from '@/shared/hooks/useDebouncedField'

import type { LogsFilters } from './api'
import { countActiveFilters, parseLogsFilters, parsePage, patchParams, replaceFilterParams } from './filters'

/**
 * Estado de la tabla de Registros en la URL (CLAUDE.md §7.10): una vista filtrada sobrevive a un
 * refresco y se puede compartir por enlace. Todos los cambios usan `replace`, como el resto de tablas
 * de Admin: los filtros no apilan entradas en el historial.
 */
export function useLogsFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(() => parseLogsFilters(searchParams), [searchParams])
  const page = parsePage(searchParams)

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams((current) => patchParams(current, patch), { replace: true })
    },
    [setSearchParams],
  )

  /** Cambia filtros sueltos manteniendo el resto; cualquier cambio vuelve a la primera página. */
  const setFilter = useCallback((patch: Partial<LogsFilters>) => update({ ...patch, page: null }), [update])

  const setPage = useCallback((next: number) => update({ page: next <= 1 ? null : String(next) }), [update])

  // El campo "Operación" escribe en la URL con retardo (§11); ver useDebouncedField para el porqué
  const operationField = useDebouncedField(filters.operation, (value) => setFilter({ operation: value }))
  const resetOperationField = operationField.reset

  /**
   * Deja los filtros EXACTAMENTE como `next` (los que no se nombran se limpian) y vuelve a la primera
   * página. Lo usan "Limpiar filtros" y el drill-down desde las tarjetas de análisis y desde el detalle
   * de una fila; sincroniza el campo de texto de Operación, que de otro modo mostraría el valor viejo.
   */
  const showOnly = useCallback(
    (next: Partial<LogsFilters>) => {
      resetOperationField(next.operation ?? '')
      setSearchParams((current) => replaceFilterParams(current, next), { replace: true })
    },
    [resetOperationField, setSearchParams],
  )

  const clearFilters = useCallback(() => showOnly({}), [showOnly])

  return {
    filters,
    page,
    activeFilterCount: countActiveFilters(filters),
    setFilter,
    setPage,
    showOnly,
    clearFilters,
    operationField,
  }
}

/** Lo que devuelve `useLogsFilters`: se pasa a los componentes que pintan la tabla y sus filtros. */
export type LogsFiltersState = ReturnType<typeof useLogsFilters>

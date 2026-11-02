import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { parsePageParam, patchParams, replaceParams, serializeParam } from '@/shared/lib/searchParams'

import { useDebouncedField } from './useDebouncedField'

/** Claves de `F` cuyo valor es texto: las únicas que pueden ser el campo de búsqueda con retardo. */
type StringKeys<F> = { [K in keyof F & string]: F[K] extends string ? K : never }[keyof F & string]

export type UrlFiltersConfig<F extends object> = {
  /** Lee los filtros de la URL. Debe ser una función de módulo (estable), no una creada en el render. */
  parse: (params: URLSearchParams) => F
  /** Parámetros de URL que son de esta tabla: `showOnly` los limpia; el resto (p. ej. `?settings=`) se conserva. */
  keys: ReadonlyArray<keyof F & string>
  /** El filtro de texto de la barra (búsqueda de usuario, de operación...): se escribe en la URL con retardo. */
  textKey: StringKeys<F>
}

export type UrlFiltersState<F extends object> = {
  filters: F
  page: number
  activeFilterCount: number
  /** Cambia filtros sueltos manteniendo el resto; cualquier cambio vuelve a la primera página. */
  setFilter: (patch: Partial<F>) => void
  setPage: (next: number) => void
  /**
   * Deja los filtros EXACTAMENTE como `next` (los que no se nombran se limpian) y vuelve a la primera
   * página. Lo usan "Limpiar filtros" y el drill-down desde tarjetas y filas; sincroniza el campo de
   * texto, que de otro modo mostraría el valor viejo.
   */
  showOnly: (next: Partial<F>) => void
  clearFilters: () => void
  /** El campo de texto de la barra: `value` al instante, la URL con retardo (ver `useDebouncedField`). */
  textField: ReturnType<typeof useDebouncedField>
}

function serializePatch(patch: Partial<Record<string, unknown>>): Record<string, string | null> {
  return Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, serializeParam(value)]))
}

/**
 * Estado de una tabla de Admin en la URL (CLAUDE.md §7.10): una vista filtrada sobrevive a un refresco y se
 * puede compartir por enlace. Todos los cambios usan `replace`, como el resto de tablas: los filtros no
 * apilan entradas en el historial. Compartido por Registros y Auditoría.
 */
export function useUrlFilters<F extends object>(config: UrlFiltersConfig<F>): UrlFiltersState<F> {
  const { parse, keys, textKey } = config
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(() => parse(searchParams), [parse, searchParams])
  const page = parsePageParam(searchParams)

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams((current) => patchParams(current, patch), { replace: true })
    },
    [setSearchParams],
  )

  // El valor confirmado del campo de texto va directo a la URL (no por `setFilter`, que lo "resetearía")
  const textField = useDebouncedField(String(filters[textKey]), (value) =>
    update({ [textKey]: serializeParam(value), page: null }),
  )
  const resetTextField = textField.reset

  const setFilter = useCallback(
    (patch: Partial<F>) => {
      // Un cambio programático del texto (elegir un usuario de una lista...) debe verse en el campo
      if (textKey in patch) resetTextField(String(patch[textKey] ?? ''))
      update({ ...serializePatch(patch), page: null })
    },
    [resetTextField, textKey, update],
  )

  const setPage = useCallback((next: number) => update({ page: next <= 1 ? null : String(next) }), [update])

  const showOnly = useCallback(
    (next: Partial<F>) => {
      resetTextField(String(next[textKey] ?? ''))
      setSearchParams((current) => replaceParams(current, keys, serializePatch(next)), { replace: true })
    },
    [keys, resetTextField, setSearchParams, textKey],
  )

  const clearFilters = useCallback(() => showOnly({}), [showOnly])

  const activeFilterCount = keys.filter((key) => {
    const value = filters[key]
    return value !== null && value !== undefined && value !== ''
  }).length

  return { filters, page, activeFilterCount, setFilter, setPage, showOnly, clearFilters, textField }
}

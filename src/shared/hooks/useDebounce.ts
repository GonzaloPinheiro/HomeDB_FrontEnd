import { useEffect, useState } from 'react'

/**
 * Devuelve `value` con un retardo: solo se propaga cuando deja de cambiar
 * durante `delayMs`. CLAUDE.md §11: usado por el buscador local de Archivos y,
 * en fases futuras, por los buscadores de las tablas de Admin.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

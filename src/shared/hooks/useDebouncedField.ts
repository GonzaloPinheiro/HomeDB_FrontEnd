import { useCallback, useEffect, useRef, useState } from 'react'

type DebouncedField = {
  /** Lo que se escribe en el campo: se actualiza en cada tecla. */
  value: string
  /** Para el `onChange` del input: actualiza `value` ya y programa `commit` tras el retardo. */
  onChange: (next: string) => void
  /**
   * Cambia `value` desde fuera (limpiar filtros, pulsar un resultado...) cancelando el `commit`
   * pendiente. NO llama a `commit`: quien lo invoca ya se ocupa de la URL.
   */
  reset: (next: string) => void
}

/**
 * Campo de texto cuyo valor confirmado (`commit`, p. ej. volcarlo a la URL) llega con retardo,
 * mientras que el texto visible se actualiza al instante (CLAUDE.md §11, §7.10).
 *
 * Sustituye al patrón `useDebounce(input)` + efecto que empuja el valor debounced a la URL: ese efecto
 * compara el valor retrasado con el de la URL y, si un cambio PROGRAMÁTICO (un drill-down, "Limpiar
 * filtros") modifica la URL antes de que el retraso termine, lo ve como "el usuario ha cambiado el
 * campo" y reescribe la URL con el valor antiguo. Aquí un cambio programático (`reset`) cancela el
 * temporizador pendiente, así que no hay nada que pueda pisarlo.
 */
export function useDebouncedField(
  initial: string,
  commit: (value: string) => void,
  delayMs = 300,
): DebouncedField {
  const [value, setValue] = useState(initial)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // `commit` suele ser una función nueva en cada render: se guarda en un ref para que el temporizador
  // use siempre la última, sin reiniciarlo ni capturar una versión obsoleta.
  const commitRef = useRef(commit)
  useEffect(() => {
    commitRef.current = commit
  })

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const onChange = useCallback(
    (next: string) => {
      setValue(next)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => commitRef.current(next), delayMs)
    },
    [delayMs],
  )

  const reset = useCallback((next: string) => {
    clearTimeout(timerRef.current)
    setValue(next)
  }, [])

  return { value, onChange, reset }
}

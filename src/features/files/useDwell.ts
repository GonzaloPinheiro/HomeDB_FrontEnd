import { useEffect, useRef } from 'react'

export const BREADCRUMB_DWELL_MS = 800

/**
 * CLAUDE.md §6.3: mantener un arrastre ~800ms sobre un segmento del breadcrumb
 * navega automáticamente a esa carpeta. `key` identifica el objetivo actual
 * (null = no hay ninguno): al cambiar o anularse antes del plazo, el
 * temporizador se cancela. Extraído del manejador de eventos para poder
 * testearlo con timers falsos (§9).
 */
export function useDwell(key: string | null, onDwell: (key: string) => void, delayMs = BREADCRUMB_DWELL_MS) {
  // El callback vive en un ref: cambiarlo no reinicia el temporizador
  const onDwellRef = useRef(onDwell)
  useEffect(() => {
    onDwellRef.current = onDwell
  }, [onDwell])

  useEffect(() => {
    if (key === null) return
    const timer = setTimeout(() => onDwellRef.current(key), delayMs)
    return () => clearTimeout(timer)
  }, [key, delayMs])
}

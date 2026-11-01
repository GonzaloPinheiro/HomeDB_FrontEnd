import { useEffect, useState } from 'react'

/**
 * "Ahora" en milisegundos, estable entre renders (llamar a `Date.now()` directamente
 * en el render lo haría distinto en cada uno). Con `ticking` se actualiza cada segundo
 * (cuenta atrás de la pausa); sin él, queda fijo en el momento del montaje.
 */
export function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!ticking) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [ticking])

  return now
}

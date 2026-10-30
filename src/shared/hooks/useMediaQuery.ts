import { useSyncExternalStore } from 'react'

// Suscripción a una media query de CSS. useSyncExternalStore (y no un useEffect +
// useState) para que el primer render ya lea el valor real y no haya un parpadeo
// con el layout equivocado. Úsalo solo cuando el layout necesite DECIDIR en JS
// (qué renderizar, a dónde llevar el foco); el resto de adaptaciones al ancho se
// hacen con las variantes responsive de Tailwind (CLAUDE.md §10).
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

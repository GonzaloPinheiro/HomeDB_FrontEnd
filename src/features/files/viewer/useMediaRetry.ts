import { useCallback, useRef, useState } from 'react'

import { api } from '@/shared/api/client'

// Un <img>/<video> no pasa por el interceptor de axios (§5.2): si el access token
// caducó (30 min) la API responde 401 y el elemento solo ve "error". Esta petición
// SÍ pasa por él: en un 401 refresca la sesión (o la expira y manda a /login, como
// cualquier otra petición de la app) y deja la cookie nueva lista para el reintento.
// Es el endpoint más barato del módulo Files que ya usa el sidebar (§6.12).
// El fallo de ESTA petición se ignora: lo que importa es el reintento del medio.
function revalidateSession(): Promise<unknown> {
  return api.get('/statistics/storage', { timeout: 10_000 }).catch(() => undefined)
}

/**
 * CLAUDE.md §6.3c: recuperación de un medio que falla al cargar. Pensado para un
 * vídeo largo cuya cookie caduca A MITAD de la reproducción (una película dura más
 * que el access token): el siguiente tramo pedido por el navegador da 401 y el
 * `<video>` entra en error.
 * - El PRIMER fallo reintenta solo, una vez, tras revalidar la sesión (invisible
 *   si era eso). Con un formato no soportado o un 404 cuesta una petición de más.
 * - El segundo muestra el error con "Reintentar" (`retry`), que repite lo mismo a
 *   demanda. `attempt` va en la `key` del elemento para remontarlo.
 * Se reinicia solo porque quien lo usa va con `key` por archivo.
 */
export function useMediaRetry() {
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  const autoRetried = useRef(false)

  const retry = useCallback(async () => {
    setFailed(false)
    await revalidateSession()
    setAttempt((current) => current + 1)
  }, [])

  const onError = useCallback(() => {
    if (autoRetried.current) {
      setFailed(true)
      return
    }
    autoRetried.current = true
    void retry()
  }, [retry])

  return { attempt, failed, onError, retry }
}

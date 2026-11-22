import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from '@/shared/api/client'
import type { ApiObjResponse } from '@/shared/types/api'

import { SAMPLE_INTERVAL_MS } from '../api'
import { storageLocationsSchema } from './types'

export const storageKeys = {
  all: ['system-monitor', 'storage'] as const,
  locations: ['system-monitor', 'storage', 'locations'] as const,
}

/**
 * GET /storage/locations — estado de cada ubicación de almacenamiento (CLAUDE.md §5.4).
 * Módulo `SystemMonitor`, sin exigir rol Admin: el Monitor ya lo exige, así que no hay guard
 * extra. Responde 200 aunque haya discos caídos (ese estado es lo que se consulta); un error
 * aquí es un 403/401 o un fallo de red.
 *
 * Sondea cada 60 s, como el resto del Monitor (§7.9): el back refresca la disponibilidad cada
 * `Storage:AvailabilityCheckIntervalSeconds` (60 por defecto) y la capacidad se lee en el momento.
 * Quien lo consuma decide el error con `data === undefined`, no con `isError` (§7.1).
 */
export function useStorageLocations() {
  return useQuery({
    queryKey: storageKeys.locations,
    queryFn: async () => {
      const response = await api.get<ApiObjResponse<unknown>>('/storage/locations')
      return storageLocationsSchema.parse(unwrap(response.data))
    },
    refetchInterval: SAMPLE_INTERVAL_MS,
  })
}

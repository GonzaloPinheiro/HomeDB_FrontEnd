import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { api, unwrap } from '@/shared/api/client'
import type { ApiObjResponse } from '@/shared/types/api'

import { folderSchema } from './types'
import type { Crumb } from './types'

export const ROOT_CRUMB: Crumb = { id: null, name: 'Inicio' }

// Clave propia (no filesKeys.contents): esto cachea METADATOS de una carpeta
// suelta (id/nombre/padre), no el listado de su contenido.
function folderByIdKey(folderId: number) {
  return ['folders', 'byId', folderId] as const
}

async function fetchFolderById(queryClient: QueryClient, folderId: number) {
  return queryClient.fetchQuery({
    queryKey: folderByIdKey(folderId),
    queryFn: async () => {
      const response = await api.get<ApiObjResponse<unknown>>(`/folders/${folderId}`)
      return folderSchema.parse(unwrap(response.data))
    },
    // El nombre de una carpeta cambia poco — no hace falta repreguntar en cada
    // resolución de ruta si ya se resolvió hace poco.
    staleTime: 5 * 60_000,
  })
}

/**
 * CLAUDE.md §5.5 (breadcrumb en deep link/refresco): sube por `parentFolderId`
 * pidiendo GET /folders/{id} nivel a nivel — es la única vía real disponible,
 * verificada contra FoldersController/FoldersService en la fase de
 * integración: no hay endpoint que devuelva la cadena de antecesores en una
 * sola llamada ni que acepte varios ids a la vez. Cada nivel se cachea con su
 * propia clave (`fetchQuery`), así que dos carpetas que comparten antecesores
 * no repiten peticiones entre sí.
 */
export async function resolveFolderPath(queryClient: QueryClient, folderId: number): Promise<Crumb[]> {
  const chain: Crumb[] = []
  let currentId: number | null = folderId
  while (currentId !== null) {
    const folder = await fetchFolderById(queryClient, currentId)
    chain.unshift({ id: folder.id, name: folder.name })
    currentId = folder.parentFolderId
  }
  return [ROOT_CRUMB, ...chain]
}

/**
 * Resuelve la ruta completa (nombres reales) de una carpeta cuando no se
 * conoce por navegación normal dentro de la app (deep link o F5 en una
 * carpeta profunda, §5.5). `enabled` lo decide el caller (FileExplorerPage):
 * solo debe pedirse cuando la carpeta actual NO está ya en el trail
 * client-side de la navegación normal, para no añadir peticiones de más.
 */
export function useFolderPath(folderId: number | null, enabled: boolean) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['folders', 'path', folderId] as const,
    queryFn: () => resolveFolderPath(queryClient, folderId as number),
    enabled: enabled && folderId !== null,
  })
}

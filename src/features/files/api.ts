import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { api, toApiError, unwrap } from '@/shared/api/client'
import type { ApiObjResponse } from '@/shared/types/api'

import { BULK_CONCURRENCY, describeBulkOutcome, runBulk } from './bulk'
import {
  deleteFileResponseSchema,
  deleteFolderResponseSchema,
  fileItemSchema,
  folderSchema,
  settingsOverviewSchema,
  storageStatsSchema,
  toExplorerFile,
  toExplorerFolder,
  type ExplorerItem,
} from './types'

// CLAUDE.md §7.5: interruptor único de PATCH /files/{id} (mover Y renombrar
// archivos — mismo endpoint, un solo flag). Verificado en la fase de
// integración: FilesController.UpdateFileAsync existe y está confirmado
// contra el código real (§2) — activado.
export const FILE_MOVE_ENABLED: boolean = true

// Claves de query de la feature. CLAUDE.md §7.8: uso y límite de almacenamiento
// son queries INDEPENDIENTES con claves distintas — las mutations invalidan solo
// la de uso, nunca la de límite.
export const filesKeys = {
  contents: (folderId: number | null) => ['files', 'contents', folderId] as const,
  storageUsage: ['storage', 'usage'] as const,
  storageLimit: ['storage', 'limit'] as const,
}

// GET /folders ya no admite ?folderId= como query param — la fase de
// integración lo dividió en dos rutas: GET /folders/subfolders (raíz) y
// GET /folders/{folderId}/subfolders (hijos de esa carpeta). Verificado en
// FoldersController/FoldersService (GetSubFoldersAsync, antes GetFoldersAsync).
function subfoldersUrl(folderId: number | null): string {
  return folderId === null ? '/folders/subfolders' : `/folders/${folderId}/subfolders`
}

/**
 * CLAUDE.md §6.3: lista única — GET /files y GET /folders/.../subfolders se
 * lanzan EN PARALELO y se combinan. Sin parámetros de orden ni paginación en
 * el backend (verificado julio 2026): el orden se aplica en cliente (sort.ts).
 */
export function useFolderContents(folderId: number | null) {
  return useQuery({
    queryKey: filesKeys.contents(folderId),
    queryFn: async (): Promise<ExplorerItem[]> => {
      const [filesResponse, foldersResponse] = await Promise.all([
        api.get<ApiObjResponse<unknown>>('/files', { params: folderId === null ? {} : { folderId } }),
        api.get<ApiObjResponse<unknown>>(subfoldersUrl(folderId)),
      ])
      const files = fileItemSchema.array().parse(unwrap(filesResponse.data))
      const folders = folderSchema.array().parse(unwrap(foldersResponse.data))
      return [...folders.map(toExplorerFolder), ...files.map(toExplorerFile)]
    },
  })
}

// CLAUDE.md §5.1: los errores de mutation se mapean con errors.ts y se muestran
// con un toast — patrón único para crear/renombrar/eliminar. La subida es la
// excepción: su error se pinta en la fila del propio archivo (UploadModal).
function toastError(error: unknown): void {
  toast.error(toApiError(error).message)
}

// Peticiones sueltas compartidas por los hooks de un elemento y los de lote
// (useBulkDelete / useBulkMove): una sola fuente de verdad del contrato de cada
// endpoint, para que ambos caminos no puedan divergir.
async function deleteFolderRequest(folderId: number) {
  const response = await api.delete<ApiObjResponse<unknown>>(`/folders/${folderId}`)
  return deleteFolderResponseSchema.parse(unwrap(response.data))
}

async function deleteFileRequest(fileId: number) {
  const response = await api.delete<ApiObjResponse<unknown>>(`/files/${fileId}`)
  return deleteFileResponseSchema.parse(unwrap(response.data))
}

async function moveFileRequest(fileId: number, targetFolderId: number | null) {
  const response = await api.patch<ApiObjResponse<unknown>>(`/files/${fileId}`, {
    newFolderId: targetFolderId,
  })
  return fileItemSchema.parse(unwrap(response.data))
}

export function useCreateFolder(parentFolderId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post<ApiObjResponse<unknown>>('/folders', {
        name,
        parentFolderId,
      })
      return folderSchema.parse(unwrap(response.data))
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: filesKeys.contents(parentFolderId) })
    },
    onError: toastError,
  })
}

export function useRenameFolder(parentFolderId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ folderId, newName }: { folderId: number; newName: string }) => {
      const response = await api.patch<ApiObjResponse<unknown>>(`/folders/${folderId}`, {
        newFolderName: newName,
      })
      return folderSchema.parse(unwrap(response.data))
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: filesKeys.contents(parentFolderId) })
    },
    onError: toastError,
  })
}

export function useDeleteFolder(parentFolderId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteFolderRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: filesKeys.contents(parentFolderId) })
      // §6.12/§7.8: cambia el espacio ocupado -> solo la query de USO
      void queryClient.invalidateQueries({ queryKey: filesKeys.storageUsage })
    },
    onError: toastError,
  })
}

export function useDeleteFile(folderId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteFileRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: filesKeys.contents(folderId) })
      void queryClient.invalidateQueries({ queryKey: filesKeys.storageUsage })
    },
    onError: toastError,
  })
}

// CLAUDE.md §6.5/§7.4: la subida de archivos ya no vive aquí como una
// mutation suelta — es un pipeline por chunks que debe seguir corriendo
// aunque el componente que lo inició se desmonte (cerrar el modal, cambiar
// de página), así que vive en un Context montado en AppShell:
// `features/files/uploadQueue/UploadQueueContext.tsx` (`useUploadQueue`).
// `filesKeys` se sigue exportando desde aquí porque esa misma pieza lo usa
// para invalidar caché al completar una subida.

/**
 * CLAUDE.md §6.3/§7.5: mover un archivo a otra carpeta (drag & drop y "Mover
 * a…"). Con FILE_MOVE_ENABLED en false no llama a la API ni muta nada — solo
 * el toast informativo. Con true: PATCH /files/{id} { newFolderId } (null =
 * raíz) e invalida el contenido de origen y destino. NO invalida
 * useStorageUsage: mover no cambia el total ocupado, solo su ubicación.
 *
 * Verificado contra FilesService.UpdateFileAsync (fase de integración): el
 * body real usa `newFolderId`/`newFileName`, NO `folderId`/`fileName` como
 * asumía CLAUDE.md §5.4 antes de esta fase. `NewFileName` se ignora si viene
 * vacío, pero `fileItem.FolderId = dto.NewFolderId` se asigna SIEMPRE sin
 * comprobar si vino en el body (no hay `.HasValue` por campo) — mover en
 * solitario es seguro (no toca el nombre), pero renombrar en solitario NO
 * puede omitir `newFolderId` o el archivo saltaría a la raíz (ver useRenameFile).
 *
 * ✅ El bug de persistencia que tuvo este endpoint (`GetByIdAsync` con
 * `asNoTracking` por defecto, así que `SaveChangesAsync` no guardaba nada
 * aunque la API respondiera 200) está ARREGLADO en el backend: ahora
 * `FilesService.UpdateFileAsync` llama a `GetByIdAsync(fileId, cToken, false)`
 * (verificado por lectura del código en octubre 2026). Confirmar con una prueba
 * real contra el despliegue — esta verificación solo comprobó el código fuente.
 */
export function useMoveFile(sourceFolderId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      fileId,
      targetFolderId,
    }: {
      fileId: number
      targetFolderId: number | null
    }) => {
      if (!FILE_MOVE_ENABLED) return null
      return moveFileRequest(fileId, targetFolderId)
    },
    onSuccess: (_moved, variables) => {
      if (!FILE_MOVE_ENABLED) {
        toast('Mover archivos aún no está disponible')
        return
      }
      void queryClient.invalidateQueries({ queryKey: filesKeys.contents(sourceFolderId) })
      void queryClient.invalidateQueries({ queryKey: filesKeys.contents(variables.targetFolderId) })
      toast.success('Archivo movido')
    },
    onError: toastError,
  })
}

/**
 * CLAUDE.md §6.3: eliminar varios elementos (archivos y carpetas) a la vez. No
 * hay endpoint por lote: una petición por elemento (`runBulk`, BULK_CONCURRENCY
 * a la vez) y UN solo toast con el resumen — un fallo no impide intentar los
 * demás. Una carpeta con contenido da `FolderNotEmpty` y se informa como fallo
 * de ese elemento, igual que al borrarla sola.
 */
export function useBulkDelete(folderId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (items: ExplorerItem[]) =>
      runBulk(
        items,
        async (item) => {
          if (item.kind === 'folder') await deleteFolderRequest(item.id)
          else await deleteFileRequest(item.id)
        },
        BULK_CONCURRENCY,
      ),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: filesKeys.contents(folderId) })
      void queryClient.invalidateQueries({ queryKey: filesKeys.storageUsage })
      const outcome = describeBulkOutcome(
        result,
        {
          done: (count) => `${count} ${count === 1 ? 'elemento eliminado' : 'elementos eliminados'}`,
          verb: 'eliminar',
        },
        (error) => toApiError(error).message,
      )
      if (outcome.ok) toast.success(outcome.message)
      else toast.error(outcome.message)
    },
    onError: toastError,
  })
}

/**
 * CLAUDE.md §6.3: mover varios archivos a una carpeta (botón "Mover" de la
 * selección y arrastrar una selección). Solo archivos: la UI no mueve carpetas
 * (§6.3). Mismo interruptor FILE_MOVE_ENABLED que `useMoveFile`.
 */
export function useBulkMove(sourceFolderId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ files, targetFolderId }: { files: ExplorerItem[]; targetFolderId: number | null }) => {
      if (!FILE_MOVE_ENABLED) return null
      return runBulk(files, async (file) => void (await moveFileRequest(file.id, targetFolderId)), BULK_CONCURRENCY)
    },
    onSuccess: (result, variables) => {
      if (result === null) {
        toast('Mover archivos aún no está disponible')
        return
      }
      void queryClient.invalidateQueries({ queryKey: filesKeys.contents(sourceFolderId) })
      void queryClient.invalidateQueries({ queryKey: filesKeys.contents(variables.targetFolderId) })
      const outcome = describeBulkOutcome(
        result,
        { done: (count) => `${count} ${count === 1 ? 'archivo movido' : 'archivos movidos'}`, verb: 'mover' },
        (error) => toApiError(error).message,
      )
      if (outcome.ok) toast.success(outcome.message)
      else toast.error(outcome.message)
    },
    onError: toastError,
  })
}

/**
 * CLAUDE.md §5.4/§7.5: renombrar un archivo — mismo endpoint que mover, mismo
 * interruptor FILE_MOVE_ENABLED. `folderId` es la carpeta donde vive HOY el
 * archivo (la que ya se le pasa a este hook para invalidar caché) — se reenvía
 * siempre como `newFolderId` aunque no cambie, porque el backend no lo trata
 * como opcional (ver nota en useMoveFile): omitirlo movería el archivo a la
 * raíz como efecto secundario de renombrarlo.
 */
export function useRenameFile(folderId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ fileId, newName }: { fileId: number; newName: string }) => {
      if (!FILE_MOVE_ENABLED) return null
      const response = await api.patch<ApiObjResponse<unknown>>(`/files/${fileId}`, {
        newFileName: newName,
        newFolderId: folderId,
      })
      return fileItemSchema.parse(unwrap(response.data))
    },
    onSuccess: () => {
      if (!FILE_MOVE_ENABLED) {
        toast('Renombrar archivos aún no está disponible')
        return
      }
      void queryClient.invalidateQueries({ queryKey: filesKeys.contents(folderId) })
      toast.success('Archivo renombrado')
    },
    onError: toastError,
  })
}

/** CLAUDE.md §6.12: uso real -> GET /statistics/storage. */
export function useStorageUsage() {
  return useQuery({
    queryKey: filesKeys.storageUsage,
    queryFn: async () => {
      const response = await api.get<ApiObjResponse<unknown>>('/statistics/storage')
      return storageStatsSchema.parse(unwrap(response.data))
    },
  })
}

/**
 * CLAUDE.md §6.12/§7.8: límite -> GET /users/me/settings-overview, query
 * independiente que las mutations NUNCA invalidan (el límite casi nunca cambia).
 * limits.storageLimitBytes puede llegar null (§5.5) — el widget lo maneja.
 */
export function useStorageLimit() {
  return useQuery({
    queryKey: filesKeys.storageLimit,
    queryFn: async () => {
      const response = await api.get<ApiObjResponse<unknown>>('/users/me/settings-overview')
      return settingsOverviewSchema.parse(unwrap(response.data))
    },
    staleTime: 30 * 60_000,
  })
}

/**
 * Descarga GET /files/{id} (binario directo, sin envelope — §5.1) vía blob +
 * enlace temporal. El nombre sale de Content-Disposition si el navegador lo
 * expone; si no (CORS sin Expose-Headers), se usa el nombre ya conocido.
 */
export async function downloadFile(fileId: number, fallbackName: string): Promise<void> {
  // CLAUDE.md §7.4: sin el timeout de 30s de la instancia — una descarga
  // grande en una conexión lenta puede tardar perfectamente más que eso.
  const response = await api.get<Blob>(`/files/${fileId}`, { responseType: 'blob', timeout: 0 })

  const disposition = (response.headers['content-disposition'] as string | undefined) ?? ''
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition)
  let fileName = fallbackName
  if (match) {
    try {
      fileName = decodeURIComponent(match[1].replace(/"/g, ''))
    } catch {
      // Un % mal formado en la cabecera lanzaría URIError con el archivo ya
      // descargado: se conserva el nombre conocido.
    }
  }

  const url = URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revocar en el mismo tick puede cancelar la descarga en algunos navegadores;
  // se difiere para que el navegador la haya iniciado ya.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

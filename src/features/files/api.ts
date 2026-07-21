import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { api, toApiError, unwrap } from '@/shared/api/client'
import type { ApiObjResponse } from '@/shared/types/api'

import {
  deleteFileResponseSchema,
  deleteFolderResponseSchema,
  fileItemSchema,
  folderSchema,
  settingsOverviewSchema,
  storageStatsSchema,
  toExplorerFile,
  toExplorerFolder,
  uploadFileResponseSchema,
  type ExplorerItem,
} from './types'

// Claves de query de la feature. CLAUDE.md §7.8: uso y límite de almacenamiento
// son queries INDEPENDIENTES con claves distintas — las mutations invalidan solo
// la de uso, nunca la de límite.
export const filesKeys = {
  contents: (folderId: number | null) => ['files', 'contents', folderId] as const,
  storageUsage: ['storage', 'usage'] as const,
  storageLimit: ['storage', 'limit'] as const,
}

function folderIdParams(folderId: number | null) {
  return folderId === null ? {} : { folderId }
}

/**
 * CLAUDE.md §6.3: lista única — GET /files y GET /folders se lanzan EN PARALELO
 * y se combinan. Sin parámetros de orden ni paginación en el backend
 * (verificado julio 2026): el orden se aplica en cliente (sort.ts).
 */
export function useFolderContents(folderId: number | null) {
  return useQuery({
    queryKey: filesKeys.contents(folderId),
    queryFn: async (): Promise<ExplorerItem[]> => {
      const [filesResponse, foldersResponse] = await Promise.all([
        api.get<ApiObjResponse<unknown>>('/files', { params: folderIdParams(folderId) }),
        api.get<ApiObjResponse<unknown>>('/folders', { params: folderIdParams(folderId) }),
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
    mutationFn: async (folderId: number) => {
      const response = await api.delete<ApiObjResponse<unknown>>(`/folders/${folderId}`)
      return deleteFolderResponseSchema.parse(unwrap(response.data))
    },
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
    mutationFn: async (fileId: number) => {
      const response = await api.delete<ApiObjResponse<unknown>>(`/files/${fileId}`)
      return deleteFileResponseSchema.parse(unwrap(response.data))
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: filesKeys.contents(folderId) })
      void queryClient.invalidateQueries({ queryKey: filesKeys.storageUsage })
    },
    onError: toastError,
  })
}

export type UploadVariables = {
  file: File
  folderId: number | null
  /** Progreso real 0-100 (onUploadProgress de axios). */
  onProgress: (percent: number) => void
}

/**
 * CLAUDE.md §6.5/§7.4: única vía de subida de todo el proyecto. Hoy es un POST
 * multipart único; cuando el backend pase a subida por paquetes solo cambia
 * esta implementación, ningún componente que la consume. Varias subidas en
 * paralelo = varias llamadas a mutateAsync, cada una con su propio onProgress.
 */
export function useUploadFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, folderId, onProgress }: UploadVariables) => {
      const formData = new FormData()
      formData.append('file', file)
      if (folderId !== null) formData.append('folderId', String(folderId))

      const response = await api.post<ApiObjResponse<unknown>>('/files', formData, {
        onUploadProgress: (event) => {
          if (event.total) onProgress(Math.round((event.loaded / event.total) * 100))
        },
      })
      return uploadFileResponseSchema.parse(unwrap(response.data))
    },
    onSuccess: (uploaded) => {
      void queryClient.invalidateQueries({ queryKey: filesKeys.contents(uploaded.folderId) })
      void queryClient.invalidateQueries({ queryKey: filesKeys.storageUsage })
    },
    // Sin toast aquí: el error se muestra en la fila del archivo (UploadModal)
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
  const response = await api.get<Blob>(`/files/${fileId}`, { responseType: 'blob' })

  const disposition = (response.headers['content-disposition'] as string | undefined) ?? ''
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition)
  const fileName = match ? decodeURIComponent(match[1].replace(/"/g, '')) : fallbackName

  const url = URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Modal } from '@/shared/components/Modal'
import { Button } from '@/shared/components/ui/button'

import { useDeleteFile, useDeleteFolder } from '../api'
import type { ExplorerItem } from '../types'

type DeleteConfirmModalProps = {
  open: boolean
  onClose: () => void
  parentFolderId: number | null
  item: ExplorerItem
}

// CLAUDE.md §6.4/§11: confirmación antes de cualquier acción destructiva —
// modal pequeño, mensaje + Cancelar/Eliminar. Un FolderNotEmpty (1005) llega
// ya mapeado desde errors.ts vía el toast de error del hook.
export function DeleteConfirmModal({ open, onClose, parentFolderId, item }: DeleteConfirmModalProps) {
  const deleteFolder = useDeleteFolder(parentFolderId)
  const deleteFile = useDeleteFile(parentFolderId)
  const isPending = deleteFolder.isPending || deleteFile.isPending

  const confirm = () => {
    const options = {
      onSuccess: () => {
        toast.success(item.kind === 'folder' ? 'Carpeta eliminada' : 'Archivo eliminado')
        onClose()
      },
    }
    if (item.kind === 'folder') deleteFolder.mutate(item.id, options)
    else deleteFile.mutate(item.id, options)
  }

  return (
    <Modal
      open={open}
      onOpenChange={(value) => !value && onClose()}
      title={item.kind === 'folder' ? 'Eliminar carpeta' : 'Eliminar archivo'}
      size="small"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : null}
            Eliminar
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-secondary">
        {item.kind === 'folder'
          ? `¿Seguro que quieres eliminar la carpeta "${item.name}"? Solo se puede eliminar si está vacía.`
          : `¿Seguro que quieres eliminar "${item.name}"? Esta acción no se puede deshacer.`}
      </p>
    </Modal>
  )
}

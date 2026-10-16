import { Loader2 } from 'lucide-react'

import { Modal } from '@/shared/components/Modal'
import { Button } from '@/shared/components/ui/button'

import { useBulkDelete } from '../api'
import type { ExplorerItem } from '../types'

type BulkDeleteModalProps = {
  open: boolean
  onClose: () => void
  parentFolderId: number | null
  items: ExplorerItem[]
}

const MAX_NAMES_SHOWN = 5

// CLAUDE.md §6.4/§11: confirmación antes de eliminar varios elementos — misma
// regla que el modal de uno solo, con el recuento y los primeros nombres para
// que se vea QUÉ se va a borrar. Las carpetas solo se eliminan si están vacías:
// las que no lo estén se informan como fallo en el resumen final (useBulkDelete).
export function BulkDeleteModal({ open, onClose, parentFolderId, items }: BulkDeleteModalProps) {
  const bulkDelete = useBulkDelete(parentFolderId)
  const hasFolders = items.some((item) => item.kind === 'folder')
  const shown = items.slice(0, MAX_NAMES_SHOWN)

  const confirm = () => {
    bulkDelete.mutate(items, { onSettled: onClose })
  }

  return (
    <Modal
      open={open}
      onOpenChange={(value) => !value && !bulkDelete.isPending && onClose()}
      title={`Eliminar ${items.length} elementos`}
      size="small"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={bulkDelete.isPending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={bulkDelete.isPending}>
            {bulkDelete.isPending ? <Loader2 className="animate-spin" /> : null}
            Eliminar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-text-secondary">
          ¿Seguro que quieres eliminar {items.length} elementos? Esta acción no se puede deshacer.
          {hasFolders && ' Las carpetas solo se eliminan si están vacías.'}
        </p>
        <ul className="flex flex-col gap-0.5 rounded-lg bg-surface px-3 py-2 text-sm text-text-primary">
          {shown.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="truncate">
              {item.name}
            </li>
          ))}
          {items.length > shown.length && (
            <li className="text-text-muted">y {items.length - shown.length} más…</li>
          )}
        </ul>
      </div>
    </Modal>
  )
}

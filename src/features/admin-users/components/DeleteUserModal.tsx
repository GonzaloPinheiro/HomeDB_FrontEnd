import { Loader2 } from 'lucide-react'

import { Modal } from '@/shared/components/Modal'
import { Button } from '@/shared/components/ui/button'

import { useDeleteUser } from '../api'
import type { UserSummary } from '../types'

type DeleteUserModalProps = {
  open: boolean
  onClose: () => void
  user: UserSummary
}

// CLAUDE.md §6.4/§11: confirmación antes de eliminar. Si falla por
// UserHasAssociatedData (1017), el hook muestra el mensaje mapeado — sin
// opción de forzarlo, no existe borrado en cascada (§5.4).
export function DeleteUserModal({ open, onClose, user }: DeleteUserModalProps) {
  const mutation = useDeleteUser()

  const confirm = () => {
    mutation.mutate(user.id, { onSuccess: onClose, onError: onClose })
  }

  return (
    <Modal
      open={open}
      onOpenChange={(value) => !value && onClose()}
      title="Eliminar usuario"
      size="small"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
            Eliminar
          </Button>
        </>
      }
    >
      <p className="text-sm text-text-secondary">
        ¿Seguro que quieres eliminar a "{user.username}"? Esta acción no se puede deshacer. Si el
        usuario tiene archivos o carpetas, el borrado fallará — no hay borrado en cascada.
      </p>
    </Modal>
  )
}

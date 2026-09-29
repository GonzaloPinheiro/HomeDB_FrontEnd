import { Modal } from '@/shared/components/Modal'
import { Button } from '@/shared/components/ui/button'

type TriggerBackupModalProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}

// CLAUDE.md §6.4/§6.14/§11: confirmación antes de una acción con efecto
// irreversible — modal pequeño, Cancelar + acción primaria. Forzar un backup NO
// es inocuo: la rotación del backend (BackupService.RunDailyBackupAsync) solo
// conserva dos copias (`backup_actual` y `backup_anterior`) y descarta la más
// antigua ANTES de empezar, así que un backup forzado (o uno que falle a medias)
// consume una de las dos copias que había. El modal se cierra al confirmar: el
// progreso lo refleja el botón del panel ("Backup en curso…"), no este diálogo.
export function TriggerBackupModal({ open, onClose, onConfirm }: TriggerBackupModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(value) => !value && onClose()}
      title="Forzar backup"
      size="small"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onConfirm}>Forzar backup</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm text-text-secondary">
        <p>Se ejecutará ahora un backup diario completo de los archivos y de la base de datos.</p>
        <p>
          Solo se conservan las dos últimas copias: al empezar se descarta la más antigua, aunque este backup
          termine con error.
        </p>
        <p className="text-text-muted">
          Puede tardar varios minutos. No cierres ni recargues la pestaña mientras se ejecuta.
        </p>
      </div>
    </Modal>
  )
}

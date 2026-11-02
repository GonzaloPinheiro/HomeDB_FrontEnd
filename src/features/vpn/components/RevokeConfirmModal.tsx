import { useState } from 'react'

import { Modal } from '@/shared/components/Modal'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { notAvailableYet } from '@/shared/lib/notAvailableYet'

import { isRevokeConfirmed } from '../presentation'

type RevokeConfirmModalProps = {
  deviceName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// CLAUDE.md §6.22, §11: revocar es irreversible (para volver a conectar el dispositivo hay que
// crear un perfil nuevo por SSH), así que no basta un clic: hay que escribir el nombre exacto.
// PENDIENTE (CLAUDE.md §6.22): "Revocar acceso" solo avisa con `notAvailableYet`. Con backend
// llamará al POST de revocar (responde 202: la revocación es asíncrona) y deberá enseñar aquí,
// dentro del modal y no como toast, los errores: 429 (el diseño del Notion le da un límite
// propio, ~10 por minuto) y 404 (el dispositivo ya no existe: cerrar y refrescar la lista).
export function RevokeConfirmModal({ deviceName, open, onOpenChange }: RevokeConfirmModalProps) {
  const [typed, setTyped] = useState('')
  const confirmed = isRevokeConfirmed(typed, deviceName)

  const handleOpenChange = (next: boolean) => {
    if (!next) setTyped('')
    onOpenChange(next)
  }

  const confirm = () => {
    if (!confirmed) return
    handleOpenChange(false)
    notAvailableYet()
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={`Revocar el acceso de «${deviceName}»`}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" disabled={!confirmed} onClick={confirm}>
            Revocar acceso
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-relaxed text-text-secondary">
          Este dispositivo perderá el acceso a la VPN de inmediato. Para volver a conectarlo habrá que crear un perfil
          nuevo por SSH.
        </p>
        <label className="flex flex-col gap-1.5 text-[13px] text-text-secondary">
          <span>
            Escribe <strong className="text-text-primary">{deviceName}</strong> para confirmar
          </span>
          <Input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') confirm()
            }}
            placeholder={deviceName}
            autoComplete="off"
            autoFocus
          />
        </label>
      </div>
    </Modal>
  )
}

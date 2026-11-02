import { useId, useState, type ReactNode } from 'react'

import { CopyButton } from '@/shared/components/CopyButton'
import { InlineMessage } from '@/shared/components/InlineMessage'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { formatBytes } from '@/shared/lib/formatBytes'
import { notAvailableYet } from '@/shared/lib/notAvailableYet'
import { cn } from '@/shared/lib/utils'

import {
  formatAgo,
  formatHandshake,
  formatHandshakeAbsolute,
  formatShortKey,
  getDeviceStatus,
  getRevocationAgeMs,
  isRevocationOverdue,
  withCurrentOwner,
} from '../presentation'
import type { VpnDevice, VpnOwner } from '../types'
import { DeviceStatusBadge } from './DeviceStatusBadge'
import { RevokeConfirmModal } from './RevokeConfirmModal'

const NO_OWNER = 'none'

type DeviceDetailModalProps = {
  /** El dispositivo a enseñar. Se conserva aunque `open` pase a false, para que no se vacíe durante el fundido de cierre. */
  device: VpnDevice | undefined
  open: boolean
  onClose: () => void
  owners: readonly VpnOwner[]
  nowMs: number
  /** §11: Radix solo devuelve el foco a un `DialogTrigger`; aquí se abre desde una tarjeta. */
  onCloseAutoFocus: (event: Event) => void
}

// CLAUDE.md §6.22 (variante B): el detalle se abre en un modal (§6.14) de ~560px y, en móvil, en
// una hoja inferior. Hay algo que editar (dueño y notas), por eso es un modal y no un despliegue
// en la fila (§6.8). Lo que se guarda es SOLO de HomeDB: no cambia la configuración de WireGuard.
export function DeviceDetailModal({ device, open, onClose, owners, nowMs, onCloseAutoFocus }: DeviceDetailModalProps) {
  return (
    <Dialog open={open && device !== undefined} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        className={cn(
          'flex max-h-[calc(100%-3rem)] w-[calc(100%-2rem)] max-w-[560px] flex-col gap-0 overflow-hidden rounded-2xl bg-card p-0 sm:rounded-2xl',
          // Móvil: hoja inferior a todo el ancho, que sube desde abajo en vez de aparecer desde el centro
          'max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:max-h-[92%] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none',
          'max-sm:data-[state=open]:[--tw-enter-translate-x:0] max-sm:data-[state=open]:[--tw-enter-translate-y:2.5rem]',
          'max-sm:data-[state=closed]:[--tw-exit-translate-x:0] max-sm:data-[state=closed]:[--tw-exit-translate-y:2.5rem]',
        )}
      >
        {device !== undefined && (
          // `key`: el borrador de dueño y notas es de ESTE dispositivo, no se arrastra al siguiente
          <DeviceDetail key={device.publicKey} device={device} owners={owners} nowMs={nowMs} />
        )}
      </DialogContent>
    </Dialog>
  )
}

type DeviceDetailProps = { device: VpnDevice; owners: readonly VpnOwner[]; nowMs: number }

function DeviceDetail({ device, owners, nowMs }: DeviceDetailProps) {
  const status = getDeviceStatus(device)
  const revoking = status === 'revoking'
  const [revokeOpen, setRevokeOpen] = useState(false)
  // Cambios del usuario sobre lo guardado; vacío = nada tocado (así no hay que copiar el
  // dispositivo a un estado local, y un refresco con datos nuevos no pisa lo que se está escribiendo)
  const [draft, setDraft] = useState<{ owner?: string; notes?: string }>({})
  const ownerId = useId()
  const notesId = useId()

  const savedOwner = device.ownerId === null ? NO_OWNER : String(device.ownerId)
  const savedNotes = device.notes ?? ''
  const owner = draft.owner ?? savedOwner
  const notes = draft.notes ?? savedNotes
  const dirty = owner !== savedOwner || notes !== savedNotes
  const ownerOptions = withCurrentOwner(owners, device)

  const revocationAge = getRevocationAgeMs(device, nowMs)
  const overdue = isRevocationOverdue(device, nowMs)

  return (
    <>
      <DialogHeader className="shrink-0 gap-2 border-b border-border-light px-[18px] py-4 pr-12 text-left">
        <DialogTitle className="text-xl font-bold tracking-tight text-text-primary">{device.name}</DialogTitle>
        <DialogDescription asChild>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <DeviceStatusBadge status={status} />
            <span className="font-mono text-[13px] text-text-secondary">{device.assignedIp}</span>
          </div>
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-[18px]">
        {revoking && revocationAge !== null && (
          <div className="flex items-start gap-3 rounded-[11px] border border-border bg-warning-bg px-3.5 py-3 text-warning-text">
            <span
              className="mt-0.5 h-[15px] w-[15px] shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug">
                {overdue ? 'La revocación sigue pendiente. Revisa el temporizador del servidor' : 'Revocación en curso'}
              </p>
              <p className="mt-[3px] text-[13px] leading-snug">
                {overdue
                  ? `Solicitada ${formatAgo(revocationAge)} y el dispositivo sigue en la lista. Las acciones están deshabilitadas mientras tanto.`
                  : `Solicitada ${formatAgo(revocationAge)}. Desaparecerá de la lista en el próximo refresco; mientras tanto las acciones están deshabilitadas.`}
              </p>
            </div>
          </div>
        )}

        <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
          <Field label="Último handshake">
            <p className="text-sm font-semibold text-text-primary">{formatHandshake(device.lastHandshakeAt, nowMs)}</p>
            <p className="mt-0.5 text-xs text-text-secondary">{formatHandshakeAbsolute(device.lastHandshakeAt)}</p>
          </Field>
          <Field label="Endpoint">
            <p
              className={cn(
                'break-all text-[13px] font-medium',
                device.endpoint === null ? 'text-text-muted-2' : 'font-mono text-text-primary',
              )}
            >
              {device.endpoint ?? 'Sin registrar'}
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">IP pública de la última conexión</p>
          </Field>
          <Field label="Recibido">
            <p className="font-mono text-sm font-medium text-text-primary">↓ {formatBytes(device.bytesReceived)}</p>
          </Field>
          <Field label="Enviado">
            <p className="font-mono text-sm font-medium text-text-primary">↑ {formatBytes(device.bytesSent)}</p>
          </Field>
          <Field label="Clave pública" className="sm:col-span-2">
            <div className="flex items-center gap-2">
              <span
                title={device.publicKey}
                className="min-w-0 flex-1 truncate rounded-lg border border-border-light bg-surface px-[11px] py-[9px] font-mono text-[13px] text-text-secondary"
              >
                {formatShortKey(device.publicKey)}
              </span>
              {/* Copia la clave COMPLETA, no la abreviada */}
              <CopyButton value={device.publicKey} className="h-[38px] shrink-0" />
            </div>
          </Field>
        </dl>

        <section className="flex flex-col gap-3 border-t border-border-light pt-[18px]">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Dueño y notas</h3>
            <p className="mt-0.5 text-xs leading-snug text-text-secondary">
              Solo se guardan en HomeDB; no cambian la configuración de WireGuard.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ownerId} className="text-xs text-text-secondary">
              Dueño
            </label>
            <Select value={owner} onValueChange={(value) => setDraft((current) => ({ ...current, owner: value }))} disabled={revoking}>
              <SelectTrigger id={ownerId} className="h-10 rounded-lg bg-surface text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_OWNER}>Sin asignar</SelectItem>
                {ownerOptions.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={notesId} className="text-xs text-text-secondary">
              Notas
            </label>
            <textarea
              id={notesId}
              value={notes}
              onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              disabled={revoking}
              rows={3}
              placeholder="Para qué se usa, quién lo lleva…"
              className="resize-y rounded-lg border border-input bg-surface px-[11px] py-[9px] text-sm leading-snug text-text-primary shadow-sm transition-colors placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            {dirty && !revoking && <InlineMessage tone="warning">Cambios sin guardar</InlineMessage>}
            {/* PENDIENTE (CLAUDE.md §6.22): conectar al PATCH de metadatos (dueño y notas) */}
            <Button type="button" disabled={!dirty || revoking} onClick={notAvailableYet}>
              Guardar
            </Button>
          </div>
        </section>

        <section className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border-light pt-[18px]">
          <div className="min-w-[200px] flex-1">
            <h3 className="text-sm font-semibold text-text-primary">Revocar acceso</h3>
            <p className="mt-0.5 text-xs leading-snug text-text-secondary">
              El dispositivo dejará de poder conectarse a la VPN.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={revoking}
            onClick={() => setRevokeOpen(true)}
            className="border-critical-text hover:bg-critical-bg hover:text-critical-text"
          >
            Revocar acceso
          </Button>
        </section>
      </div>

      <RevokeConfirmModal deviceName={device.name} open={revokeOpen} onOpenChange={setRevokeOpen} />
    </>
  )
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="mb-1 text-xs text-text-secondary">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

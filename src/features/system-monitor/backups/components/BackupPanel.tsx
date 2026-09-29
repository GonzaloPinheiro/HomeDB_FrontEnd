import { DatabaseBackup, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { toApiError } from '@/shared/api/client'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatBytes } from '@/shared/lib/formatBytes'
import { formatDateTime, formatShortDateTime } from '@/shared/lib/formatDate'

import { useBackupHistory, useTriggerBackup } from '../api'
import { summarizeBackups, totalBackupBytes } from '../summary'
import { BackupHistoryList } from './BackupHistoryList'
import { BackupStatusBadge } from './BackupStatusBadge'
import { TriggerBackupModal } from './TriggerBackupModal'

// CLAUDE.md §6.13: cuadro lateral de la tarjeta Disco — sistema de backups
// diarios. Altura fija en escritorio (la misma que el skeleton del Monitor,
// 292px = gráfico + padding) con el historial desplazable por dentro: así la
// fila del grid no crece con el número de entradas y el gráfico no se estira.
const PANEL_CLASS = 'flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:h-[292px]'

/**
 * Solo se monta para un Admin: `BackupController` exige rol Admin ADEMÁS del
 * módulo SystemMonitor (§5.3 "módulo activado no implica rol Admin") — el
 * caller (`MetricSidePanel`) decide, aquí no se vuelve a comprobar.
 */
export function BackupPanel() {
  const history = useBackupHistory(true)
  const trigger = useTriggerBackup()
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (history.isPending) {
    return (
      <div className={PANEL_CLASS} aria-hidden>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="min-h-0 flex-1" />
      </div>
    )
  }

  if (history.isError) {
    return (
      <div className={`${PANEL_CLASS} items-center justify-center text-center`}>
        <p className="text-sm font-medium text-text-secondary">No se pudo cargar el historial</p>
        <p className="text-xs text-text-muted">{toApiError(history.error).message}</p>
        <Button variant="outline" size="sm" onClick={() => void history.refetch()}>
          Reintentar
        </Button>
      </div>
    )
  }

  const { latest, lastSuccess, isRunning } = summarizeBackups(history.data.items)
  const busy = isRunning || trigger.isPending

  const confirm = () => {
    setConfirmOpen(false)
    trigger.mutate()
  }

  return (
    <div className={PANEL_CLASS}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary">Backups diarios</h3>
        {latest && <BackupStatusBadge status={latest.status} />}
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Último correcto</span>
        {lastSuccess ? (
          <p className="text-sm text-text-primary">
            <time dateTime={lastSuccess.startedAt} title={formatDateTime(lastSuccess.startedAt)}>
              {formatShortDateTime(lastSuccess.startedAt)}
            </time>
            <span className="text-text-muted-2"> · {formatBytes(totalBackupBytes(lastSuccess))}</span>
          </p>
        ) : (
          <span className="text-sm text-text-primary">—</span>
        )}
      </div>

      <Button variant="outline" className="w-full" onClick={() => setConfirmOpen(true)} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <DatabaseBackup />}
        {busy ? 'Backup en curso…' : 'Forzar backup'}
      </Button>

      <div className="flex min-h-0 flex-1 flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">Historial</span>
        {history.data.items.length === 0 ? (
          <p className="py-2 text-xs text-text-muted">
            Todavía no se ha ejecutado ningún backup. El diario se lanza solo a la hora programada en el servidor.
          </p>
        ) : (
          // max-h en móvil: sin altura fija de panel, la lista no debe alargar la pantalla sin límite
          <div className="-mr-2 max-h-64 min-h-0 flex-1 overflow-y-auto pr-2 lg:max-h-none">
            <BackupHistoryList items={history.data.items} />
          </div>
        )}
      </div>

      <TriggerBackupModal open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={confirm} />
    </div>
  )
}

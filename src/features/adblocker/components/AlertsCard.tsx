import { FloatCard } from '@/shared/components/FloatCard'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Switch } from '@/shared/components/ui/switch'
import { notAvailableYet } from '@/shared/lib/notAvailableYet'
import { cn } from '@/shared/lib/utils'
import { useState } from 'react'

import { useAlertSettings } from '../api'
import { formatPercent, parseThresholdPercent } from '../presentation'

// CLAUDE.md §6.21: aviso por email si el % bloqueado de las últimas 24 h baja de un umbral.
// El formulario se edita y valida de verdad; "Guardar" solo avisa con `notAvailableYet`.
// PENDIENTE (CLAUDE.md §6.21): conectar a `PUT /adblocker/alert-settings`. El backend
// necesitará enviar emails (hoy no hay infraestructura: la recuperación de contraseña por
// email es una mejora futura) y saber a QUÉ dirección: `/auth/register` crea usuarios sin
// email, así que el admin puede no tener ninguno.
export function AlertsCard({ currentPercent }: { currentPercent: number | null }) {
  const settings = useAlertSettings()
  // Cambios del usuario sobre lo guardado; vacío = nada tocado (así no hay que copiar la
  // respuesta del servidor a un estado local cuando llega)
  const [draft, setDraft] = useState<{ enabled?: boolean; threshold?: string }>({})

  const saved = settings.data
  if (settings.isPending) {
    return (
      <FloatCard className="flex min-w-0 flex-col gap-3.5 p-5 sm:px-[22px]" aria-busy>
        <h2 className="text-[15px] font-semibold text-text-primary">Alertas</h2>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-9 w-2/3" />
      </FloatCard>
    )
  }
  if (saved === undefined) {
    return (
      <FloatCard className="flex min-w-0 flex-col gap-3.5 p-5 sm:px-[22px]">
        <h2 className="text-[15px] font-semibold text-text-primary">Alertas</h2>
        <p className="text-sm text-text-muted">No se pudieron cargar los ajustes de alertas.</p>
      </FloatCard>
    )
  }

  const enabled = draft.enabled ?? saved.enabled
  const thresholdText = draft.threshold ?? String(saved.thresholdPercent)
  const threshold = parseThresholdPercent(thresholdText)
  const changed = enabled !== saved.enabled || thresholdText !== String(saved.thresholdPercent)
  const canSave = threshold.ok && changed

  return (
    <FloatCard className="flex min-w-0 flex-col gap-3.5 p-5 sm:px-[22px]">
      <h2 className="text-[15px] font-semibold text-text-primary">Alertas</h2>

      <label className="flex cursor-pointer items-start gap-3">
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => setDraft((current) => ({ ...current, enabled: checked }))}
          className="mt-px"
        />
        <span>
          <span className="block text-sm font-semibold text-text-primary">
            Avisarme por email si baja el % de bloqueo
          </span>
          <span className="mt-0.5 block text-xs text-text-secondary">
            Se compara con el % de las últimas 24 h
            {currentPercent !== null && ` (${formatPercent(currentPercent)} ahora)`}.
          </span>
        </span>
      </label>

      <div className={cn('flex flex-wrap items-center gap-2.5', !enabled && 'opacity-55')}>
        <label htmlFor="adblocker-alert-threshold" className="text-[13px] text-text-secondary">
          Umbral
        </label>
        <div className="flex items-center gap-1.5">
          <Input
            id="adblocker-alert-threshold"
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            value={thresholdText}
            disabled={!enabled}
            onChange={(event) => setDraft((current) => ({ ...current, threshold: event.target.value }))}
            aria-invalid={!threshold.ok}
            className={cn('h-9 w-[78px] font-mono text-[13px]', !threshold.ok && 'border-critical-text')}
          />
          <span className="text-[13px] text-text-secondary">%</span>
        </div>
        <Button type="button" className="ml-auto" disabled={!canSave} onClick={notAvailableYet}>
          Guardar
        </Button>
      </div>
      {!threshold.ok && <p className="-mt-1.5 text-xs text-critical-text">{threshold.message}</p>}
      {canSave && <p className="-mt-1.5 text-xs text-warning-text">Cambios sin guardar</p>}
    </FloatCard>
  )
}

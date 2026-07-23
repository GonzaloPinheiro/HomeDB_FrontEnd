import { cn } from '@/shared/lib/utils'

import { normalizeFanControlMode } from '../fanControlMode'
import type { SystemMetrics } from '../types'

const MODE_LABEL: Record<ReturnType<typeof normalizeFanControlMode>, string> = {
  off: 'Apagado',
  manual: 'Manual',
  automatic: 'Automático',
  unknown: 'Desconocido',
}

/**
 * CLAUDE.md §6.13: punto de estado (verde en marcha / rojo si no) + rpm, en
 * línea con el valor de temperatura — vive DENTRO de la tarjeta, no aparte.
 */
export function FanStatusInline({ metric }: { metric: SystemMetrics }) {
  const isRunning = metric.fanIsRunning
  return (
    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          isRunning === true && 'bg-positive-text',
          isRunning === false && 'bg-critical-text',
          isRunning === null && 'bg-text-faint',
        )}
        aria-hidden
      />
      <span>{metric.fanRpmSpeed !== null ? `${metric.fanRpmSpeed} rpm` : 'Sin dato'}</span>
    </div>
  )
}

/** CLAUDE.md §6.13: panel lateral con el detalle completo del ventilador, solo al seleccionar Temperatura. */
export function FanDetailPanel({ metric }: { metric: SystemMetrics }) {
  const mode = normalizeFanControlMode(metric.fanControlMode)
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-text-primary">Ventilador</h3>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Estado">
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                metric.fanIsRunning === true && 'bg-positive-text',
                metric.fanIsRunning === false && 'bg-critical-text',
                metric.fanIsRunning === null && 'bg-text-faint',
              )}
              aria-hidden
            />
            {metric.fanIsRunning === true ? 'En marcha' : metric.fanIsRunning === false ? 'Parado' : '—'}
          </span>
        </Field>
        <Field label="RPM">{metric.fanRpmSpeed ?? '—'}</Field>
        <Field label="Modo">{MODE_LABEL[mode]}</Field>
        <Field label="PWM">{metric.fanPwmDutyCycle !== null ? `${metric.fanPwmDutyCycle}%` : '—'}</Field>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</span>
      <span className="text-sm text-text-primary">{children}</span>
    </div>
  )
}

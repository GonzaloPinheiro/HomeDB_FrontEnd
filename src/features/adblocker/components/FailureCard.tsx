import { ShieldAlert } from 'lucide-react'

import { FloatCard } from '@/shared/components/FloatCard'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

import { FAILURE_VIEWS, type AdBlockerFailureKind, type FailureView } from '../failures'

type FailureCardProps = {
  kind: AdBlockerFailureKind
  /** Mensaje del error, solo para `other` (el resto tiene su texto propio). */
  message: string
  onRetry: () => void
}

function resolveView(kind: AdBlockerFailureKind, message: string): FailureView {
  if (kind !== 'other') return FAILURE_VIEWS[kind]
  return { label: 'Error', title: 'No se pudo cargar AdGuard', body: message, tone: 'critical', canRetry: true }
}

// CLAUDE.md §6.21: la pantalla no puede mostrarse (sin configurar, credenciales, sin
// conexión, sin acceso...). Warning si falta algo por hacer, Critical si algo falla (§6.7).
export function FailureCard({ kind, message, onRetry }: FailureCardProps) {
  const view = resolveView(kind, message)
  return (
    <FloatCard className="mx-auto mt-5 flex w-full max-w-[560px] flex-col items-start gap-3 px-[30px] py-8">
      <div
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-xl',
          view.tone === 'warning' ? 'bg-warning-bg text-warning-text' : 'bg-critical-bg text-critical-text',
        )}
      >
        <ShieldAlert className="h-[22px] w-[22px]" aria-hidden />
      </div>
      <p className="font-mono text-[11px] uppercase tracking-wide text-text-muted-2">{view.label}</p>
      <h2 className="text-xl font-bold tracking-tight text-text-primary">{view.title}</h2>
      <p className="text-sm leading-relaxed text-text-secondary">{view.body}</p>
      {view.canRetry && (
        <Button type="button" variant="outline" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </FloatCard>
  )
}

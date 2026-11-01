import { ShieldAlert } from 'lucide-react'

import { FloatCard } from '@/shared/components/FloatCard'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

type FailureCardProps = {
  /** Línea pequeña en mayúsculas sobre el título (p. ej. "Sin conexión"). */
  label: string
  title: string
  body: string
  /** Warning (falta algo por hacer) o Critical (algo falla), CLAUDE.md §6.7. */
  tone: 'warning' | 'critical'
  /** Solo se ofrece "Reintentar" si el problema puede resolverse solo: sin handler, sin botón. */
  onRetry?: () => void
}

// Tarjeta centrada para una pantalla que no puede mostrarse (sin configurar, sin conexión,
// sin acceso...). Compartida por AdGuard (§6.21) y VPN (§6.22): cada feature decide el texto.
export function FailureCard({ label, title, body, tone, onRetry }: FailureCardProps) {
  return (
    <FloatCard className="mx-auto mt-5 flex w-full max-w-[560px] flex-col items-start gap-3 px-[30px] py-8">
      <div
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-xl',
          tone === 'warning' ? 'bg-warning-bg text-warning-text' : 'bg-critical-bg text-critical-text',
        )}
      >
        <ShieldAlert className="h-[22px] w-[22px]" aria-hidden />
      </div>
      <p className="font-mono text-[11px] uppercase tracking-wide text-text-muted-2">{label}</p>
      <h2 className="text-xl font-bold tracking-tight text-text-primary">{title}</h2>
      <p className="text-sm leading-relaxed text-text-secondary">{body}</p>
      {onRetry !== undefined && (
        <Button type="button" variant="outline" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </FloatCard>
  )
}

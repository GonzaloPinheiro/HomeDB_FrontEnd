import { TriangleAlert } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'

// CLAUDE.md §6.21: aviso (Warning, §6.7) de que el servidor está limitando las consultas.
// El 429 es el del limitador global de HomeDB (§7.4), no el de AdGuard: el texto no culpa
// a AdGuard. La pantalla sigue visible con los últimos datos recibidos.
export function RateLimitBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-warning-bg px-4 py-3 text-[13px] leading-snug text-warning-text"
    >
      <TriangleAlert className="h-[18px] w-[18px] shrink-0" aria-hidden />
      <p className="min-w-[220px] flex-1">
        <strong>Demasiadas peticiones (429).</strong> El servidor está limitando las consultas. Ves los últimos datos
        recibidos y los cambios no se guardarán hasta que se libere.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  )
}

import { History } from 'lucide-react'

import { FloatCard } from '@/shared/components/FloatCard'

// PENDIENTE (CLAUDE.md §6.18): "Actividad reciente". El backend no expone ningún
// endpoint de actividad propia del usuario: el log de auditoría (§5.4) es solo
// para quien tiene el módulo AuditLogs y recoge TODOS los usuarios, y
// GET /files no ordena por fecha de subida. Se deja el hueco del diseño sin
// filas inventadas; cuando exista el endpoint, pintar aquí las entradas y
// añadir el enlace "Ver todo" del diseño.
export function RecentActivityCard() {
  return (
    <FloatCard className="flex flex-col px-6 py-[22px]">
      <h2 className="text-[15px] font-semibold text-text-primary">Actividad reciente</h2>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface">
          <History className="h-5 w-5 text-text-muted" aria-hidden />
        </div>
        <p className="max-w-xs text-sm text-text-secondary">
          Aquí aparecerá tu actividad reciente. Todavía no está disponible.
        </p>
      </div>
    </FloatCard>
  )
}

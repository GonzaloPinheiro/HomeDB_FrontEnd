import { Info, RefreshCw } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

import { formatAgo, getSnapshotAgeMs, isSnapshotStale } from '../presentation'
import { MockBadge } from '../mock/MockBadge'
import type { VpnSnapshot } from '../types'

type VpnHeaderProps = {
  snapshot: VpnSnapshot | undefined
  nowMs: number
  refreshing: boolean
  onRefresh: () => void
}

// CLAUDE.md §6.22: cabecera con el mismo ritmo que Inicio, Monitor y AdGuard (§6.18, §6.13,
// §6.21): línea secundaria + título grande. A la derecha, cuándo se leyó WireGuard por última
// vez y el botón de actualizar. Debajo, cómo se añade un dispositivo (no se puede desde HomeDB).
export function VpnHeader({ snapshot, nowMs, refreshing, onRefresh }: VpnHeaderProps) {
  const stale = snapshot !== undefined && isSnapshotStale(snapshot.snapshotAt, nowMs)

  return (
    <header className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2.5">
        <div>
          {/* div y no p: el Badge de la maqueta es un div */}
          <div className="mb-1.5 flex items-center gap-2 text-[13px] text-text-secondary">
            Red doméstica
            <MockBadge />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-[30px]">VPN</h1>
        </div>

        {snapshot !== undefined && (
          <div className="flex items-center gap-2 text-[13px] text-text-secondary">
            <span
              className={cn('h-[7px] w-[7px] rounded-full', stale ? 'bg-warning-text' : 'bg-positive-text')}
              aria-hidden
            />
            <span aria-live="polite">
              {refreshing ? 'Actualizando…' : `Actualizado ${formatAgo(getSnapshotAgeMs(snapshot.snapshotAt, nowMs))}`}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-[30px] w-[30px]"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Actualizar ahora"
              title="Actualizar ahora"
            >
              <RefreshCw className={cn('h-[15px] w-[15px]', refreshing && 'animate-spin motion-reduce:animate-none')} aria-hidden />
            </Button>
          </div>
        )}
      </div>

      <p className="flex items-start gap-2 text-[13px] leading-relaxed text-text-secondary">
        <Info className="mt-0.5 h-[15px] w-[15px] shrink-0" aria-hidden />
        <span>
          Los dispositivos nuevos se añaden por SSH con{' '}
          <code className="whitespace-nowrap rounded-[5px] border border-border-light bg-surface px-1.5 py-px font-mono text-xs text-text-primary">
            pivpn add
          </code>
        </span>
      </p>
    </header>
  )
}

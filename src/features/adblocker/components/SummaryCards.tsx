import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { FloatCard } from '@/shared/components/FloatCard'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatInteger } from '@/shared/lib/formatNumber'
import { cn } from '@/shared/lib/utils'

import {
  clampPercent,
  formatPercent,
  oneInEvery,
  queriesPerHour,
} from '../presentation'
import type { AdBlockerStats } from '../types'

type SummaryCardProps = { label: string; value: ReactNode; caption?: ReactNode; muted?: boolean; children?: ReactNode }

// Misma tipografía que las StatCards de Inicio (§6.18): etiqueta xs, cifra de 26px en negrita.
function SummaryCard({ label, value, caption, muted = false, children }: SummaryCardProps) {
  return (
    <FloatCard className="p-5">
      <div className="text-xs text-text-secondary">{label}</div>
      <div className={cn('mt-2.5 text-[26px] font-bold tracking-tight', muted ? 'text-text-faint' : 'text-text-primary')}>
        {value}
      </div>
      {children}
      {caption !== undefined && <div className="mt-1 text-xs text-text-secondary">{caption}</div>}
    </FloatCard>
  )
}

// CLAUDE.md §6.21: la ventana de las cifras es siempre de 24 h (es lo que da AdGuard).
// `thresholdPercent` es el umbral de alerta, si ya se conoce: se marca sobre la barra.
export function SummaryCards({
  stats,
  thresholdPercent,
}: {
  stats: UseQueryResult<AdBlockerStats>
  thresholdPercent: number | null
}) {
  if (stats.isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-hidden>
        {['Consultas DNS · 24 h', 'Bloqueadas · 24 h', '% bloqueado · 24 h'].map((label) => (
          <FloatCard key={label} className="p-5">
            <div className="text-xs text-text-secondary">{label}</div>
            <Skeleton className="mt-2.5 h-8 w-24" />
            <Skeleton className="mt-2 h-3 w-32" />
          </FloatCard>
        ))}
      </div>
    )
  }

  // `data === undefined` y no `isError` (§7.1): un refetch fallido deja el último dato visible
  if (stats.data === undefined) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Consultas DNS · 24 h" value="—" caption="No se pudo cargar" muted />
        <SummaryCard label="Bloqueadas · 24 h" value="—" caption="No se pudo cargar" muted />
        <SummaryCard label="% bloqueado · 24 h" value="—" caption="No se pudo cargar" muted />
      </div>
    )
  }

  const { totalQueries, blockedQueries, blockedPercentage } = stats.data
  const oneIn = oneInEvery(blockedPercentage)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <SummaryCard
        label="Consultas DNS · 24 h"
        value={formatInteger(totalQueries)}
        caption={`≈ ${formatInteger(queriesPerHour(totalQueries))} por hora`}
      />
      <SummaryCard
        label="Bloqueadas · 24 h"
        value={formatInteger(blockedQueries)}
        caption={oneIn === null ? 'Ninguna consulta bloqueada' : `1 de cada ${formatInteger(oneIn)} consultas`}
      />
      <SummaryCard
        label="% bloqueado · 24 h"
        value={<span className="text-accent-tint-text">{formatPercent(blockedPercentage)}</span>}
        caption={thresholdPercent !== null ? `Umbral de alerta ${thresholdPercent} %` : undefined}
      >
        {/* Barra con la marca del umbral de alerta: si el % baja de ahí, se avisa por email */}
        <div
          className="relative mt-2.5 h-[6px] rounded-full bg-border-light"
          role="img"
          aria-label={`${formatPercent(blockedPercentage)} bloqueado${thresholdPercent !== null ? `, umbral de alerta ${thresholdPercent} %` : ''}`}
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${clampPercent(blockedPercentage)}%` }} />
          {thresholdPercent !== null && (
            <div
              className="absolute -top-1 h-3.5 w-0.5 bg-warning-text"
              style={{ left: `calc(${clampPercent(thresholdPercent)}% - 1px)` }}
            />
          )}
        </div>
      </SummaryCard>
    </div>
  )
}

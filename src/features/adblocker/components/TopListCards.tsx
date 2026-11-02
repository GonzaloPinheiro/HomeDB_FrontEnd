import type { UseQueryResult } from '@tanstack/react-query'

import { FloatCard } from '@/shared/components/FloatCard'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatInteger } from '@/shared/lib/formatNumber'
import { cn } from '@/shared/lib/utils'

import type { AdBlockerStats } from '../types'

type TopRow = { name: string; count: number; mono: boolean }

type TopListCardProps = {
  title: string
  meta: string
  rows: TopRow[] | undefined
  /** Color de la barra: acento para lo bloqueado, neutro para los clientes. */
  barClassName: string
  isPending: boolean
}

function TopListCard({ title, meta, rows, barClassName, isPending }: TopListCardProps) {
  const max = rows !== undefined && rows.length > 0 ? rows[0].count : 1

  return (
    <FloatCard className="min-w-0 p-5 sm:px-[22px]">
      <div className="flex items-baseline justify-between gap-2.5">
        <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>
        <span className="whitespace-nowrap text-xs text-text-secondary">{meta}</span>
      </div>

      <div className="mt-2.5 flex flex-col" aria-busy={isPending}>
        {isPending ? (
          Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="my-1.5 h-7 w-full" />)
        ) : rows === undefined ? (
          <p className="py-3.5 text-sm text-text-muted">No se pudo cargar.</p>
        ) : rows.length === 0 ? (
          <p className="py-3.5 text-sm text-text-muted">Sin datos en las últimas 24 h.</p>
        ) : (
          rows.map((row, index) => (
            <div
              key={row.name}
              className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-[5px] py-1.5"
            >
              <span className="font-mono text-[11px] text-text-muted-2">{index + 1}</span>
              <span
                className={cn('truncate text-text-primary', row.mono ? 'font-mono text-xs' : 'text-[13px]')}
                title={row.name}
              >
                {row.name}
              </span>
              <span className="font-mono text-xs text-text-secondary">{formatInteger(row.count)}</span>
              {/* Barra relativa al primero de la lista, no al total */}
              <div className="col-span-2 col-start-2 h-1 rounded-sm bg-border-light" aria-hidden>
                <div className={cn('h-full rounded-sm', barClassName)} style={{ width: `${(row.count / max) * 100}%` }} />
              </div>
            </div>
          ))
        )}
      </div>
    </FloatCard>
  )
}

export function TopDomainsCard({ stats }: { stats: UseQueryResult<AdBlockerStats> }) {
  return (
    <TopListCard
      title="Top 10 dominios bloqueados"
      meta="Últimas 24 h"
      isPending={stats.isPending}
      rows={stats.data?.topBlockedDomains.map((item) => ({ name: item.domain, count: item.count, mono: true }))}
      barClassName="bg-accent"
    />
  )
}

export function TopClientsCard({ stats }: { stats: UseQueryResult<AdBlockerStats> }) {
  return (
    <TopListCard
      title="Top 10 clientes"
      meta="Consultas · 24 h"
      isPending={stats.isPending}
      // Un cliente sin nombre se identifica por su IP: esas van en monoespaciada
      rows={stats.data?.topClients.map((item) => ({
        name: item.clientIdentifier,
        count: item.count,
        mono: /^\d/.test(item.clientIdentifier),
      }))}
      barClassName="bg-text-muted-2"
    />
  )
}

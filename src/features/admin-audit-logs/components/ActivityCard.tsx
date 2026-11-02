import { CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { toApiError } from '@/shared/api/client'
import { FloatCard } from '@/shared/components/FloatCard'
import { InlineMessage } from '@/shared/components/InlineMessage'
import { SegmentedControl } from '@/shared/components/SegmentedControl'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatUtcDay } from '@/shared/lib/formatDate'
import { formatInteger } from '@/shared/lib/formatNumber'
import { cn } from '@/shared/lib/utils'

import { useAuditActivity } from '../api'
import {
  ACTIVITY_RANGE_IDS,
  ACTIVITY_RANGES,
  DEFAULT_ACTIVITY_RANGE,
  summarizeActivity,
  type ActivityRangeId,
} from '../activity'

const RANGE_OPTIONS = ACTIVITY_RANGE_IDS.map((id) => ({ value: id, label: ACTIVITY_RANGES[id].label }))

// Los días son UTC ("AAAA-MM-DD"): se formatean EN UTC para que el eje no se desplace un día según la zona local
const TICK_FORMAT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })

function tickLabel(day: string): string {
  return TICK_FORMAT.format(new Date(`${day}T00:00:00Z`)).replace(/\./g, '')
}

// PENDIENTE (CLAUDE.md §6.24): solo se monta con `AUDIT_ACTIVITY_ENABLED` (api.ts), porque el endpoint no existe
// en el backend todavía. Actividad por día en barras; mismo estilo de gráfico que el Monitor (§6.13).
export default function ActivityCard() {
  const [rangeId, setRangeId] = useState<ActivityRangeId>(DEFAULT_ACTIVITY_RANGE)
  const query = useAuditActivity(ACTIVITY_RANGES[rangeId].days)
  const summary = query.data === undefined ? null : summarizeActivity(query.data)

  return (
    <FloatCard className="p-5 sm:px-[22px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[15px] font-semibold text-text-primary">Actividad por día</h2>
        {summary !== null && (
          <span className="text-xs text-text-secondary">
            {formatInteger(summary.total)} acciones
            {summary.peak !== null && ` · pico el ${formatUtcDay(summary.peak.date)} (${formatInteger(summary.peak.count)})`}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-text-secondary">Acciones registradas cada día (días UTC).</p>
      <div className="mt-3">
        <SegmentedControl
          aria-label="Periodo de la actividad por día"
          value={rangeId}
          options={RANGE_OPTIONS}
          onChange={setRangeId}
        />
      </div>

      <div className="mt-3" aria-busy={query.isPending || query.isFetching}>
        {query.isPending ? (
          <Skeleton className="h-[220px] w-full" />
        ) : query.data === undefined ? (
          // `data === undefined` y no `isError` (§7.1): un refetch fallido deja el último dato visible
          <div className="flex flex-col items-start gap-3 py-2">
            <InlineMessage tone="critical">{toApiError(query.error).message}</InlineMessage>
            <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : summary !== null && summary.total === 0 ? (
          <div className="flex items-center gap-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-text-muted">
              <CircleCheck className="h-[18px] w-[18px]" aria-hidden />
            </div>
            <p className="text-sm text-text-secondary">Sin actividad en este periodo.</p>
          </div>
        ) : (
          <div className={cn('transition-opacity', query.isPlaceholderData && 'opacity-50')}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={query.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={tickLabel}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                  minTickGap={16}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip
                  cursor={{ fill: 'var(--row-hover)' }}
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(value) => (typeof value === 'string' ? formatUtcDay(value) : '')}
                  formatter={(value) => [typeof value === 'number' ? formatInteger(value) : '—', 'Acciones']}
                />
                <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </FloatCard>
  )
}

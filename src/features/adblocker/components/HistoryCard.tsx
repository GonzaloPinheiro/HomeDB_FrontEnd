import { useMemo, useState } from 'react'

import { toApiError } from '@/shared/api/client'
import { FloatCard } from '@/shared/components/FloatCard'
import { SegmentedControl, type SegmentedOption } from '@/shared/components/SegmentedControl'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/utils'

import { useAdBlockerHistory } from '../api'
import {
  HISTORY_RANGES,
  HISTORY_RANGE_LABELS,
  defaultCustomRange,
  resolveHistoryWindow,
  toChartPoints,
  type HistoryRange,
} from '../history'
import { useNow } from '@/shared/hooks/useNow'
import { HISTORY_CHART_HEIGHT, HistoryChart, type HistoryView } from './HistoryChart'

const VIEW_OPTIONS: ReadonlyArray<SegmentedOption<HistoryView>> = [
  { value: 'count', label: 'Consultas' },
  { value: 'percent', label: '% bloqueo' },
]

const RANGE_OPTIONS = HISTORY_RANGES.map((range) => ({ value: range, label: HISTORY_RANGE_LABELS[range] }))

const PLACEHOLDER_CLASSES = 'flex items-center justify-center rounded-[10px] border border-dashed border-border p-5 text-center'

// CLAUDE.md §6.21: histórico con vista (consultas / % bloqueo) y rango (24 h, 7 d, 30 d o
// fechas). Cuatro estados: cargando, sin datos todavía, rango inválido y error.
export function HistoryCard({ thresholdPercent }: { thresholdPercent: number | null }) {
  const now = useNow(false)
  const [view, setView] = useState<HistoryView>('count')
  const [range, setRange] = useState<HistoryRange>('24h')
  const [customDates, setCustomDates] = useState(() => defaultCustomRange(new Date()))

  const query = { range, from: customDates.from, to: customDates.to }
  const rangeCheck = resolveHistoryWindow(query, now)
  const history = useAdBlockerHistory(query, rangeCheck.ok)
  const points = useMemo(() => (history.data ? toChartPoints(history.data) : []), [history.data])

  const placeholderStyle = { minHeight: HISTORY_CHART_HEIGHT }

  return (
    <FloatCard className="flex min-w-0 flex-col p-5 sm:px-[22px]">
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
        <h2 className="text-[15px] font-semibold text-text-primary">Histórico</h2>
        <Legend view={view} thresholdPercent={thresholdPercent} />
        <div className="ml-auto flex flex-wrap gap-2">
          <SegmentedControl value={view} options={VIEW_OPTIONS} onChange={setView} aria-label="Qué mostrar" />
          <SegmentedControl value={range} options={RANGE_OPTIONS} onChange={setRange} aria-label="Rango de tiempo" />
        </div>
      </div>

      {range === 'custom' && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[13px] text-text-secondary">
          <label className="flex items-center gap-1.5">
            Desde
            <Input
              type="date"
              value={customDates.from}
              onChange={(event) => setCustomDates((dates) => ({ ...dates, from: event.target.value }))}
              className="h-8 w-auto"
            />
          </label>
          <label className="flex items-center gap-1.5">
            Hasta
            <Input
              type="date"
              value={customDates.to}
              onChange={(event) => setCustomDates((dates) => ({ ...dates, to: event.target.value }))}
              className="h-8 w-auto"
            />
          </label>
        </div>
      )}

      <div className="mt-4 flex-1">
        {!rangeCheck.ok ? (
          <div className={cn(PLACEHOLDER_CLASSES, 'bg-critical-bg text-sm text-critical-text')} style={placeholderStyle}>
            {rangeCheck.message}
          </div>
        ) : history.isPending ? (
          <Skeleton className="w-full" style={placeholderStyle} />
        ) : history.data === undefined ? (
          // §7.1: `data === undefined` y no `isError`
          <div className={cn(PLACEHOLDER_CLASSES, 'text-sm text-text-muted')} style={placeholderStyle}>
            {toApiError(history.error).message}
          </div>
        ) : points.length === 0 ? (
          <div className={cn(PLACEHOLDER_CLASSES, 'flex-col gap-1.5')} style={placeholderStyle}>
            <p className="text-sm font-semibold text-text-primary">Recopilando datos…</p>
            <p className="text-[13px] text-text-secondary">El histórico se rellena cada pocos minutos.</p>
          </div>
        ) : (
          <HistoryChart points={points} view={view} range={range} thresholdPercent={thresholdPercent} />
        )}
      </div>
    </FloatCard>
  )
}

function Legend({ view, thresholdPercent }: { view: HistoryView; thresholdPercent: number | null }) {
  return (
    <div className="flex items-center gap-3 text-xs text-text-secondary">
      {view === 'count' ? (
        <>
          <LegendItem swatch="bg-text-faint" label="Consultas" />
          <LegendItem swatch="bg-accent" label="Bloqueadas" />
        </>
      ) : (
        <>
          <LegendItem swatch="bg-accent" label="% bloqueado" />
          {thresholdPercent !== null && (
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 border-t-2 border-dashed border-warning-text" aria-hidden />
              Umbral de alerta ({thresholdPercent} %)
            </span>
          )}
        </>
      )}
    </div>
  )
}

function LegendItem({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-2.5 w-2.5 rounded-[3px]', swatch)} aria-hidden />
      {label}
    </span>
  )
}

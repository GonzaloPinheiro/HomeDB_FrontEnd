import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatInteger } from '@/shared/lib/formatNumber'

import {
  formatAxisTick,
  formatCompact,
  formatTooltipTitle,
  niceMax,
  pickAxisTicks,
  type HistoryChartPoint,
  type HistoryRange,
} from '../history'
import { formatPercent } from '../presentation'

export type HistoryView = 'count' | 'percent'

type HistoryChartProps = {
  points: HistoryChartPoint[]
  view: HistoryView
  range: HistoryRange
  /** Umbral de alerta en %, si se conoce: solo se dibuja en la vista de porcentaje. */
  thresholdPercent: number | null
}

export const HISTORY_CHART_HEIGHT = 250

// CLAUDE.md §3/§6.21: recharts, no SVG a mano. Consultas = área neutra de fondo con las
// bloqueadas en acento encima; % bloqueo = una sola área con el umbral de alerta como
// línea discontinua (mismo recurso que el Monitor, §6.13).
// PENDIENTE (CLAUDE.md §6.21): la maqueta recibe ≤120 puntos. Con el backend real pueden
// ser miles (una muestra cada X minutos, sin agregar): aplicar entonces un diezmado en
// cliente como el del Monitor (`downsample.ts`, a subir a `shared/lib` al usarse en dos
// features). OJO: esa versión se queda con el máximo de cada tramo, válida para un
// porcentaje pero no para contadores, que habría que sumar o promediar.
export function HistoryChart({ points, view, range, thresholdPercent }: HistoryChartProps) {
  const isCount = view === 'count'

  const yMax = useMemo(() => {
    if (isCount) return niceMax(Math.max(...points.map((point) => point.totalQueries)))
    const peak = Math.max(...points.map((point) => point.blockedPercent), thresholdPercent ?? 0)
    return Math.min(100, Math.max(40, Math.ceil(peak / 10) * 10))
  }, [isCount, points, thresholdPercent])

  const axisTicks = useMemo(() => pickAxisTicks(points, range), [points, range])

  const pointByTimestamp = useMemo(() => new Map(points.map((point) => [point.timestamp, point])), [points])

  return (
    <ResponsiveContainer width="100%" height={HISTORY_CHART_HEIGHT}>
      <AreaChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="adTotalFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--text-faint)" stopOpacity={0.45} />
            <stop offset="95%" stopColor="var(--text-faint)" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="adBlockedFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(value: string) => formatAxisTick(value, range)}
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
          ticks={axisTicks}
          minTickGap={48}
        />
        <YAxis
          domain={[0, yMax]}
          tickFormatter={(value: number) => (isCount ? formatCompact(value) : `${Math.round(value)} %`)}
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          cursor={{ stroke: 'var(--text-muted)', strokeWidth: 1 }}
          content={({ active, label }) => {
            const point = typeof label === 'string' ? pointByTimestamp.get(label) : undefined
            if (!active || point === undefined) return null
            return (
              <div className="min-w-[150px] rounded-lg border border-border bg-card px-3 py-2 text-xs leading-relaxed text-text-primary shadow-float">
                <div className="font-bold">{formatTooltipTitle(point.timestamp, range)}</div>
                <TooltipRow label="Consultas" value={formatInteger(point.totalQueries)} />
                <TooltipRow label="Bloqueadas" value={formatInteger(point.blockedQueries)} />
                <TooltipRow label="% bloqueo" value={formatPercent(point.blockedPercent)} />
              </div>
            )
          }}
        />
        {!isCount && thresholdPercent !== null && (
          <ReferenceLine
            y={thresholdPercent}
            stroke="var(--warning-text)"
            strokeDasharray="6 5"
            ifOverflow="extendDomain"
            label={{
              value: `Umbral ${thresholdPercent} %`,
              position: 'insideTopRight',
              fill: 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 600,
            }}
          />
        )}
        {isCount ? (
          <>
            <Area
              type="monotone"
              dataKey="totalQueries"
              stroke="var(--text-muted-2)"
              strokeWidth={1.5}
              fill="url(#adTotalFill)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="blockedQueries"
              stroke="var(--accent)"
              strokeWidth={2}
              fill="url(#adBlockedFill)"
              isAnimationActive={false}
            />
          </>
        ) : (
          <Area
            type="monotone"
            dataKey="blockedPercent"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#adBlockedFill)"
            isAnimationActive={false}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-text-secondary">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}

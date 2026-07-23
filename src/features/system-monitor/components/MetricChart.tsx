import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { SystemMetrics } from '../types'

type MetricDataKey = 'cpuUsagePercent' | 'memoryUsagePercent' | 'diskUsagePercent' | 'temperatureCelsius'

type MetricChartProps = {
  data: SystemMetrics[]
  dataKey: MetricDataKey
  unit: string
  threshold: number
  /** CLAUDE.md §6.13: fijo 0-100 para métricas en porcentaje; libre (auto) para temperatura. */
  fixedDomain?: boolean
}

const TICK_FORMAT = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const TOOLTIP_FORMAT = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

// CLAUDE.md §6.13: área/línea con recharts, línea de referencia discontinua
// en el umbral. Los `null` (sensor caído, §5.4) deben verse como un hueco en
// el trazo, nunca interpretarse como 0 — recharts ya rompe el trazo en `null`
// mientras no se fuerce `connectNulls`, así que basta con no coercionar el
// valor a 0 en ningún punto de la preparación de datos.
export function MetricChart({ data, dataKey, unit, threshold, fixedDomain }: MetricChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="metricFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(value: string) => TICK_FORMAT.format(new Date(value))}
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          domain={fixedDomain ? [0, 100] : ['auto', 'auto']}
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(value) => (typeof value === 'string' ? TOOLTIP_FORMAT.format(new Date(value)) : '')}
          formatter={(value) => [typeof value === 'number' ? `${value.toFixed(1)}${unit}` : 'Sin dato', '']}
        />
        <ReferenceLine
          y={threshold}
          stroke="var(--critical-text)"
          strokeDasharray="4 4"
          ifOverflow="extendDomain"
          label={{ value: `Umbral ${threshold}${unit}`, position: 'insideTopRight', fill: 'var(--critical-text)', fontSize: 11 }}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke="var(--accent)"
          strokeWidth={2}
          fill="url(#metricFill)"
          connectNulls={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

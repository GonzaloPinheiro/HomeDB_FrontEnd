import { cn } from '@/shared/lib/utils'

import { METRIC_RANGES, RANGE_LABELS, type MetricRange } from '../api'

type RangeChipsProps = {
  value: MetricRange
  onChange: (range: MetricRange) => void
}

// CLAUDE.md §6.13: chips de rango — nunca un selector de fechas libre.
export function RangeChips({ value, onChange }: RangeChipsProps) {
  return (
    <div className="flex gap-1 rounded-lg border border-border bg-surface p-1" role="group" aria-label="Rango de tiempo">
      {METRIC_RANGES.map((range) => (
        <button
          key={range}
          type="button"
          aria-pressed={value === range}
          onClick={() => onChange(range)}
          className={cn(
            'rounded-md px-3 py-1 text-sm font-medium transition-colors',
            value === range
              ? 'bg-accent text-text-on-accent'
              : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary',
          )}
        >
          {RANGE_LABELS[range]}
        </button>
      ))}
    </div>
  )
}

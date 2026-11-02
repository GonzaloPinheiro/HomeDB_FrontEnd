import { useState } from 'react'

import { SegmentedControl } from '@/shared/components/SegmentedControl'
import { formatInteger } from '@/shared/lib/formatNumber'

import { useErrorSummary, type LogsFilters } from '../api'
import {
  barPercent,
  criticalDrillDown,
  criticalMeta,
  DEFAULT_ERROR_SUMMARY_RANGE,
  ERROR_SUMMARY_RANGE_IDS,
  ERROR_SUMMARY_RANGES,
  type ErrorSummaryRangeId,
} from '../presentation'
import { InsightCard } from './InsightCard'
import { InsightList, InsightRow } from './InsightRow'

const RANGE_OPTIONS = ERROR_SUMMARY_RANGE_IDS.map((id) => ({ value: id, label: ERROR_SUMMARY_RANGES[id].label }))

// CLAUDE.md §6.23: excepciones no controladas (nivel Critical) agrupadas por operación. El rango vive en
// el estado del componente (como el del Monitor, §6.13): es una vista del resumen, no un filtro de la tabla.
export function CriticalErrorsCard({ onShowLogs }: { onShowLogs: (filters: Partial<LogsFilters>) => void }) {
  const [rangeId, setRangeId] = useState<ErrorSummaryRangeId>(DEFAULT_ERROR_SUMMARY_RANGE)
  const range = ERROR_SUMMARY_RANGES[rangeId]
  const query = useErrorSummary(range.hours)

  return (
    <InsightCard
      title="Excepciones críticas"
      description="Excepciones no controladas del servidor, por operación. Pulsa una para ver sus registros."
      meta={query.data !== undefined ? criticalMeta(query.data, range.label) : undefined}
      controls={
        <SegmentedControl
          aria-label="Rango de tiempo de las excepciones críticas"
          value={rangeId}
          options={RANGE_OPTIONS}
          onChange={setRangeId}
        />
      }
      query={query}
      emptyTitle="Sin excepciones críticas"
      emptyDescription={`Ninguna en las últimas ${range.label}.`}
    >
      {(items) => {
        const max = Math.max(...items.map((item) => item.count))
        return (
          <InsightList>
            {items.map((item, index) => (
              <InsightRow
                key={item.operation}
                rank={index + 1}
                name={item.operation}
                value={formatInteger(item.count)}
                percent={barPercent(item.count, max)}
                // Rojo: es la única señal de gravedad de la pantalla (§6.7); las lentas usan el acento
                barClassName="bg-critical-text"
                ariaLabel={`${item.operation}: ${formatInteger(item.count)} excepciones críticas. Ver sus registros`}
                onSelect={() => onShowLogs(criticalDrillDown(item))}
              />
            ))}
          </InsightList>
        )
      }}
    </InsightCard>
  )
}

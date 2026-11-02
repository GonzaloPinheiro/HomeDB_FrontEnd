import { useState } from 'react'

import { SegmentedControl } from '@/shared/components/SegmentedControl'
import { Button } from '@/shared/components/ui/button'
import { formatShortDateTime } from '@/shared/lib/formatDate'
import { formatMillis } from '@/shared/lib/formatDuration'

import { useSlowOperations, type LogsFilters } from '../api'
import {
  barPercent,
  DEFAULT_SLOW_THRESHOLD,
  SLOW_OPERATIONS_LIMIT,
  SLOW_PREVIEW_COUNT,
  SLOW_THRESHOLD_IDS,
  SLOW_THRESHOLDS,
  slowDrillDown,
  slowMeta,
  type SlowThresholdId,
} from '../presentation'
import { InsightCard } from './InsightCard'
import { InsightList, InsightRow } from './InsightRow'

const THRESHOLD_OPTIONS = SLOW_THRESHOLD_IDS.map((id) => ({ value: id, label: SLOW_THRESHOLDS[id].label }))

// CLAUDE.md §6.23: las ejecuciones más lentas por encima de un umbral. El endpoint no acota por fechas
// (§5.4), por eso la tarjeta lo dice en vez de sugerir una ventana reciente que no existe.
export function SlowOperationsCard({ onShowLogs }: { onShowLogs: (filters: Partial<LogsFilters>) => void }) {
  const [thresholdId, setThresholdId] = useState<SlowThresholdId>(DEFAULT_SLOW_THRESHOLD)
  const [expanded, setExpanded] = useState(false)
  const threshold = SLOW_THRESHOLDS[thresholdId]
  const query = useSlowOperations(threshold.thresholdMs)

  return (
    <InsightCard
      title="Operaciones lentas"
      description="Las ejecuciones que más han tardado. Pulsa una para ver sus registros ese día."
      meta={query.data !== undefined ? slowMeta(query.data.length, threshold.label) : undefined}
      controls={
        <SegmentedControl
          aria-label="Umbral de duración de las operaciones lentas"
          value={thresholdId}
          options={THRESHOLD_OPTIONS}
          onChange={setThresholdId}
        />
      }
      query={query}
      emptyTitle="Ninguna operación lenta"
      emptyDescription={`Ninguna tarda más de ${threshold.label}.`}
      footnote={`Las ${SLOW_OPERATIONS_LIMIT} más lentas de todo el histórico de registros, sin límite de fechas.`}
    >
      {(items) => {
        const max = Math.max(...items.map((item) => item.durationMs))
        const visible = expanded ? items : items.slice(0, SLOW_PREVIEW_COUNT)
        return (
          <>
            <InsightList>
              {visible.map((item, index) => (
                <InsightRow
                  // El endpoint no da id: operación + instante + posición es único dentro de la lista
                  key={`${item.operation}|${item.timeStamp}|${index}`}
                  rank={index + 1}
                  name={item.operation}
                  value={formatMillis(item.durationMs)}
                  percent={barPercent(item.durationMs, max)}
                  barClassName="bg-accent"
                  detail={formatShortDateTime(item.timeStamp)}
                  ariaLabel={`${item.operation}: ${formatMillis(item.durationMs)}, el ${formatShortDateTime(item.timeStamp)}. Ver sus registros de ese día`}
                  onSelect={() => onShowLogs(slowDrillDown(item))}
                />
              ))}
            </InsightList>
            {items.length > SLOW_PREVIEW_COUNT && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 -ml-2"
                aria-expanded={expanded}
                onClick={() => setExpanded((current) => !current)}
              >
                {expanded ? 'Ver menos' : `Ver todas (${items.length})`}
              </Button>
            )}
          </>
        )
      }}
    </InsightCard>
  )
}

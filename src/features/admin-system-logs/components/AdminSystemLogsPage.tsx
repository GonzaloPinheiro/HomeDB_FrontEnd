import { useRef } from 'react'

import { useMediaQuery } from '@/shared/hooks/useMediaQuery'

import type { LogsFilters } from '../api'
import { useLogsFilters } from '../useLogsFilters'
import { CriticalErrorsCard } from './CriticalErrorsCard'
import { LogsExplorer } from './LogsExplorer'
import { LogsHealthCards } from './LogsHealthCards'
import { LogsHeader } from './LogsHeader'
import { SlowOperationsCard } from './SlowOperationsCard'

// CLAUDE.md §6.23: de arriba abajo, de lo general a lo concreto —cifras de salud, dos análisis
// (críticas y lentas) y la tabla—. Los análisis son atajos: pulsar una fila deja la tabla filtrada
// exactamente a lo que se ha pulsado y lleva la pantalla hasta ella.
export function AdminSystemLogsPage() {
  const state = useLogsFilters()
  const explorerRef = useRef<HTMLElement>(null)
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  const showInTable = (filters: Partial<LogsFilters>) => {
    state.showOnly(filters)
    const section = explorerRef.current
    section?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    // Sin scroll propio (ya lo hace scrollIntoView): el foco anuncia el cambio a lectores de pantalla (§11)
    section?.focus({ preventScroll: true })
  }

  return (
    // §6.13/§6.18: mismo padding de página y hueco de 22px entre bloques que Inicio y Monitor
    <div className="flex min-h-full flex-col gap-[22px] px-4 py-6 sm:px-8 sm:py-[26px]">
      <LogsHeader />
      <LogsHealthCards />
      {/* items-start: dos listas de longitud muy distinta no deben estirarse a la misma altura (hueco vacío) */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <CriticalErrorsCard onShowLogs={showInTable} />
        <SlowOperationsCard onShowLogs={showInTable} />
      </div>
      <LogsExplorer ref={explorerRef} state={state} onShowOnly={showInTable} />
    </div>
  )
}

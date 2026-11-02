import { toApiError } from '@/shared/api/client'

import { useAdBlockerStats, useAdBlockerStatus, useAlertSettings } from '../api'
import { getAdBlockerFailure } from '../failures'
import { getPanelHost } from '../presentation'
import { AdBlockerHeader } from './AdBlockerHeader'
import { AdBlockerSkeleton } from './AdBlockerSkeleton'
import { AlertsCard } from './AlertsCard'
import { AllowlistCard } from './AllowlistCard'
import { BlockedServicesCard } from './BlockedServicesCard'
import { DomainCheckerCard } from './DomainCheckerCard'
import { FailureCard } from './FailureCard'
import { FilterListsCard } from './FilterListsCard'
import { HistoryCard } from './HistoryCard'
import { ProtectionCard } from './ProtectionCard'
import { RateLimitBanner } from './RateLimitBanner'
import { SummaryCards } from './SummaryCards'
import { TopClientsCard, TopDomainsCard } from './TopListCards'

// CLAUDE.md §6.21: pantalla de AdGuard Home (solo Admin, ver el guard de la ruta). Una sola
// página con scroll, en este orden: estado y control -> resumen -> histórico -> tops ->
// comprobador y permitidos -> servicios -> listas y alertas.
// PENDIENTE (CLAUDE.md §6.21): maqueta — ver `api.ts` para lo que falta al llegar el backend.
export function AdBlockerDashboard() {
  const status = useAdBlockerStatus()
  const stats = useAdBlockerStats()
  const alerts = useAlertSettings()

  // Sin estado no hay pantalla: o carga, o se explica por qué no se puede mostrar. Usa
  // `data === undefined` y no `isError` (§7.1): un refetch fallido deja el último estado.
  const failed = !status.isPending && status.data === undefined

  // Se vigila `stats` para el aviso de 429: es la consulta que más se repetirá (sondeo)
  const rateLimited = stats.isError && getAdBlockerFailure(stats.error) === 'rateLimited'

  const thresholdPercent = alerts.data?.thresholdPercent ?? null

  return (
    <div className="flex min-h-full flex-col gap-[22px] px-4 py-6 sm:px-8 sm:py-[26px]">
      <AdBlockerHeader panelHost={getPanelHost(status.data?.panelUrl ?? null)} />

      {status.isPending && <AdBlockerSkeleton />}

      {failed && (
        <FailureCard
          kind={getAdBlockerFailure(status.error)}
          message={toApiError(status.error).message}
          onRetry={() => void status.refetch()}
        />
      )}

      {status.data !== undefined && (
        <>
          {rateLimited && <RateLimitBanner onRetry={() => void stats.refetch()} />}

          <ProtectionCard status={status.data} />
          <SummaryCards stats={stats} thresholdPercent={thresholdPercent} />
          <HistoryCard thresholdPercent={thresholdPercent} />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <TopDomainsCard stats={stats} />
            <TopClientsCard stats={stats} />
          </div>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <DomainCheckerCard />
            <AllowlistCard />
          </div>

          <BlockedServicesCard />

          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
            <FilterListsCard />
            <AlertsCard currentPercent={stats.data?.blockedPercentage ?? null} />
          </div>
        </>
      )}
    </div>
  )
}

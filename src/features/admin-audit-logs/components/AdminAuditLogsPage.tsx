import { lazy, Suspense } from 'react'

import { PageHeader } from '@/shared/components/PageHeader'
import { QueryRefreshButton } from '@/shared/components/QueryRefreshButton'
import { Skeleton } from '@/shared/components/ui/skeleton'

import { AUDIT_ACTIVITY_ENABLED, auditLogsKeys } from '../api'
import { useAuditFilters } from '../useAuditFilters'
import { AuditExplorer } from './AuditExplorer'
import { AuditSummaryCards } from './AuditSummaryCards'

// recharts pesa: la tarjeta de actividad se descarga solo si el interruptor está activo y la página se pinta
const ActivityCard = lazy(() => import('./ActivityCard'))

// CLAUDE.md §6.24: cifras de las últimas 24 h y la tabla. Mismo ritmo de página que Registros, Inicio y Monitor
// (§6.23, §6.18, §6.13).
export function AdminAuditLogsPage() {
  const state = useAuditFilters()

  return (
    <div className="flex min-h-full flex-col gap-[22px] px-4 py-6 sm:px-8 sm:py-[26px]">
      {/* Refrescar invalida la clave raíz: las cifras (con staleTime) y la tabla vuelven a pedirse */}
      <PageHeader
        eyebrow="Actividad de las cuentas"
        title="Auditoría"
        actions={<QueryRefreshButton queryKey={auditLogsKeys.all} />}
      />
      <AuditSummaryCards />
      {/* PENDIENTE (CLAUDE.md §6.24): el endpoint de actividad por día no existe todavía */}
      {AUDIT_ACTIVITY_ENABLED && (
        <Suspense fallback={<Skeleton className="h-[340px] w-full rounded-[14px]" />}>
          <ActivityCard />
        </Suspense>
      )}
      <AuditExplorer state={state} />
    </div>
  )
}

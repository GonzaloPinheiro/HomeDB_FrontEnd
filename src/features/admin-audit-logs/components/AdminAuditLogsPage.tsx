import { PageHeader } from '@/shared/components/PageHeader'
import { QueryRefreshButton } from '@/shared/components/QueryRefreshButton'

import { auditLogsKeys } from '../api'
import { useAuditFilters } from '../useAuditFilters'
import { AuditExplorer } from './AuditExplorer'
import { AuditSummaryCards } from './AuditSummaryCards'

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
      <AuditExplorer state={state} />
    </div>
  )
}

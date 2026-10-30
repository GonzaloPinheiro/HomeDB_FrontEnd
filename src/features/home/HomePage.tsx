import { LayoutGrid } from 'lucide-react'

import { EmptyState } from '@/shared/components/EmptyState'
import { PageSkeleton } from '@/shared/components/PageSkeleton'
import { useAuth } from '@/shared/hooks/useAuth'
import { usePermissions } from '@/shared/hooks/usePermissions'
import { formatLongDate } from '@/shared/lib/formatDate'
import type { AppModule } from '@/shared/types/api'

import { RecentActivityCard } from './components/RecentActivityCard'
import { ServerStatusCard } from './components/ServerStatusCard'
import { ShortcutsCard } from './components/ShortcutsCard'
import { ExpensesStatCard, FilesStatCard, PortfolioStatCard } from './components/StatCards'
import { getGreeting } from './greeting'

// Módulos con pantalla real (§5.3: Expenses/Investments/RemoteScripts son solo
// flags, no cuentan para decidir si el usuario "tiene algo que ver").
const MODULES_WITH_SCREEN: AppModule[] = [
  'Files',
  'Torrents',
  'SystemMonitor',
  'UserManagement',
  'SystemLogs',
  'AuditLogs',
]

// CLAUDE.md §6.18: pantalla de inicio (diseño "1c, lienzo hundido") — es la
// primera que se ve tras el login ("/"). No exige ningún módulo: cada tarjeta
// resuelve por su cuenta si el usuario tiene acceso a sus datos.
export default function HomePage() {
  const { claims } = useAuth()
  const { hasModule, isLoading } = usePermissions()

  if (isLoading) return <PageSkeleton />

  // CLAUDE.md §5.3/§6.9: usuario sin ningún módulo activo — informativo, sin
  // botón (no puede activarse módulos a sí mismo)
  if (!MODULES_WITH_SCREEN.some((module) => hasModule(module))) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="Sin módulos activados"
        description="Tu cuenta no tiene acceso a ningún módulo todavía. Un administrador debe activarlos por ti."
      />
    )
  }

  const now = new Date()

  return (
    <div className="flex min-h-full flex-col gap-[22px] px-4 py-6 sm:px-8 sm:py-[26px]">
      <header>
        <p className="mb-1.5 text-[13px] text-text-secondary">{formatLongDate(now)}</p>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-[30px]">
          {getGreeting(now)}, {claims?.username}
        </h1>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FilesStatCard />
        <ExpensesStatCard />
        <PortfolioStatCard />
      </div>

      <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[1.35fr_1fr]">
        <RecentActivityCard />
        <div className="flex min-h-0 flex-col gap-4">
          <ServerStatusCard />
          <ShortcutsCard />
        </div>
      </div>
    </div>
  )
}

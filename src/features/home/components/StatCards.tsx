import type { ReactNode } from 'react'

import { useStorageUsage } from '@/features/files/api'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { usePermissions } from '@/shared/hooks/usePermissions'
import { formatBytes } from '@/shared/lib/formatBytes'
import { formatInteger } from '@/shared/lib/formatNumber'
import { cn } from '@/shared/lib/utils'

import { FloatCard } from './FloatCard'

type StatCardProps = {
  label: string
  value: ReactNode
  caption: ReactNode
  /** Valor sin dato real (placeholder): se atenúa para que no parezca una cifra. */
  muted?: boolean
}

function StatCard({ label, value, caption, muted = false }: StatCardProps) {
  return (
    <FloatCard className="p-5">
      <div className="text-xs text-text-secondary">{label}</div>
      <div
        className={cn(
          'mt-2.5 text-[26px] font-bold tracking-tight',
          muted ? 'text-text-faint' : 'text-text-primary',
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-text-secondary">{caption}</div>
    </FloatCard>
  )
}

function StatCardSkeleton({ label }: { label: string }) {
  return (
    <FloatCard className="p-5">
      <div className="text-xs text-text-secondary">{label}</div>
      <Skeleton className="mt-2.5 h-8 w-24" />
      <Skeleton className="mt-2 h-3 w-32" />
    </FloatCard>
  )
}

// Un hook por componente interno: useStorageUsage no se puede llamar
// condicionalmente, y sin el módulo Files el endpoint responde 403 (§5.3) —
// por eso el guard de módulo vive en el componente externo.
function FilesStatCardContent() {
  const usage = useStorageUsage()

  if (usage.isPending) return <StatCardSkeleton label="Archivos" />
  if (usage.isError)
    return <StatCard label="Archivos" value="—" caption="No se pudo cargar" muted />

  const { totalFiles, totalFolders, totalSizeBytes } = usage.data
  return (
    <StatCard
      label="Archivos"
      value={formatInteger(totalFiles)}
      caption={`${formatInteger(totalFolders)} ${totalFolders === 1 ? 'carpeta' : 'carpetas'} · ${formatBytes(totalSizeBytes)}`}
    />
  )
}

// Cifra real: GET /statistics/storage (§5.4). Las altas "de esta semana" del
// diseño no existen en el contrato, así que no se muestran.
export function FilesStatCard() {
  const { hasModule } = usePermissions()
  if (!hasModule('Files'))
    return <StatCard label="Archivos" value="—" caption="Módulo no activado" muted />
  return <FilesStatCardContent />
}

// PENDIENTE (CLAUDE.md §5.3/§6.18): Expenses e Investments son módulos
// fantasma — no hay endpoint ni datos. Se deja la tarjeta como base del layout,
// SIN cifras inventadas; cuando exista el módulo, sustituir por una tarjeta con
// su propia query (igual que FilesStatCard).
export function ExpensesStatCard() {
  return <StatCard label="Gastos" value="—" caption="Próximamente" muted />
}

export function PortfolioStatCard() {
  return <StatCard label="Cartera" value="—" caption="Próximamente" muted />
}

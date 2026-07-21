import { useStorageLimit, useStorageUsage } from '@/features/files/api'
import { Progress } from '@/shared/components/ui/progress'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatBytes } from '@/shared/lib/formatBytes'
import { usePermissions } from '@/shared/hooks/usePermissions'

// CLAUDE.md §6.12: barra de progreso + "X GB de Y GB" al pie del sidebar
// expandido. Dos queries independientes (§7.8): uso (statistics/storage) y
// límite (settings-overview) — el límite nunca se invalida desde mutations.
export function StorageWidget() {
  const { hasModule } = usePermissions()
  const usage = useStorageUsage()
  const limit = useStorageLimit()

  // Los endpoints de uso exigen el módulo Files — sin él, no hay widget
  if (!hasModule('Files')) return null

  if (usage.isPending) {
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-surface-alt p-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2 w-full" />
      </div>
    )
  }
  if (usage.isError) return null

  const usedBytes = usage.data.totalSizeBytes
  // §5.5: el límite puede llegar null (sin resolver) — solo el uso, sin "de X"
  const limitBytes = limit.data?.limits.storageLimitBytes ?? null

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface-alt p-3">
      <span className="text-xs font-medium text-text-secondary">Almacenamiento</span>
      {limitBytes !== null ? (
        <>
          <Progress
            value={Math.min(100, (usedBytes / limitBytes) * 100)}
            className="h-1.5"
            aria-label="Uso de almacenamiento"
          />
          <span className="text-xs text-text-muted">
            {formatBytes(usedBytes)} de {formatBytes(limitBytes)}
          </span>
        </>
      ) : (
        <span className="text-xs text-text-muted">{formatBytes(usedBytes)} usados</span>
      )}
    </div>
  )
}

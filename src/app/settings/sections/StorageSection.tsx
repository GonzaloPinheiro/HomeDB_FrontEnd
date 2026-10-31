import { HardDrive } from 'lucide-react'

import { useStorageLimit, useStorageUsage } from '@/features/files/api'
import { toApiError } from '@/shared/api/client'
import { EmptyState } from '@/shared/components/EmptyState'
import { Progress } from '@/shared/components/ui/progress'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { usePermissions } from '@/shared/hooks/usePermissions'
import { formatBytes } from '@/shared/lib/formatBytes'
import { formatInteger } from '@/shared/lib/formatNumber'

import { SettingsCard, SettingsPanel, SettingsRow } from '../SettingsLayout'

// Contenido con los hooks de datos, en un componente interno: los hooks no se pueden
// llamar condicionalmente y, sin el módulo Files, ni siquiera debe dispararse la
// petición (daría 403, §5.3) — mismo patrón que StorageWidget (§6.12).
function StorageContent() {
  const usage = useStorageUsage()
  const limit = useStorageLimit()

  if (usage.isPending) {
    return (
      <SettingsCard>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-2 w-full" />
        </div>
      </SettingsCard>
    )
  }
  // §7.1: sin datos en la primera carga = error; un refetch fallido deja los últimos valores.
  if (usage.data === undefined) {
    return (
      <p className="text-sm text-text-secondary">
        No se pudo cargar el uso de almacenamiento: {toApiError(usage.error).message}
      </p>
    )
  }

  const usedBytes = usage.data.totalSizeBytes
  // §5.5: el límite puede llegar null (sin resolver) — nunca se asume uno por defecto.
  const limitBytes = limit.data?.limits.storageLimitBytes ?? null
  const maxFileBytes = limit.data?.limits.maxFileSizeBytes ?? null
  const percent =
    limitBytes !== null && limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes) * 100) : null

  return (
    <>
      <SettingsCard>
        <p className="text-2xl font-semibold text-text-primary">
          {formatBytes(usedBytes)}
          {limitBytes !== null ? (
            <span className="text-base font-normal text-text-secondary">
              {' '}
              de {formatBytes(limitBytes)}
            </span>
          ) : null}
        </p>
        {percent !== null ? (
          <>
            <Progress value={percent} className="mt-3 h-2" aria-label="Uso de almacenamiento" />
            <p className="mt-2 text-xs text-text-muted">{Math.round(percent)}% usado</p>
          </>
        ) : (
          <p className="mt-2 text-xs text-text-muted">
            Tu límite de almacenamiento no está disponible.
          </p>
        )}
      </SettingsCard>

      <SettingsCard title="Detalle">
        <SettingsRow title="Archivos">
          <span className="text-sm text-text-primary">{formatInteger(usage.data.totalFiles)}</span>
        </SettingsRow>
        <SettingsRow title="Carpetas">
          <span className="text-sm text-text-primary">
            {formatInteger(usage.data.totalFolders)}
          </span>
        </SettingsRow>
        <SettingsRow title="Tamaño máximo por archivo">
          <span className="text-sm text-text-primary">
            {maxFileBytes !== null ? formatBytes(maxFileBytes) : 'No disponible'}
          </span>
        </SettingsRow>
      </SettingsCard>
    </>
  )
}

export function StorageSection() {
  const { hasModule } = usePermissions()

  return (
    <SettingsPanel
      title="Almacenamiento"
      description="Cuánto espacio usas y los límites de tu cuenta."
    >
      {hasModule('Files') ? (
        <StorageContent />
      ) : (
        <EmptyState
          icon={HardDrive}
          title="Archivos no está activado"
          description="Tu cuenta no tiene acceso al módulo de archivos, así que no hay almacenamiento que mostrar."
        />
      )}
    </SettingsPanel>
  )
}

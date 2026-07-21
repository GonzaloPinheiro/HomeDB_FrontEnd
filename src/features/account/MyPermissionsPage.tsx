import { ShieldCheck } from 'lucide-react'

import { EmptyState } from '@/shared/components/EmptyState'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { usePermissions } from '@/shared/hooks/usePermissions'
import { ALL_MODULES, MODULE_LABELS } from '@/shared/lib/moduleLabels'
import { cn } from '@/shared/lib/utils'

// Vista de SOLO LECTURA de los permisos propios — un usuario no puede
// cambiárselos a sí mismo (§5.3). Reutiliza usePermissions (§7.3), sin
// duplicar la query de /users/me/permissions.
export default function MyPermissionsPage() {
  const { isAdmin, hasModule, isLoading } = usePermissions()

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold text-text-primary">Mis permisos</h1>

      {isAdmin ? (
        // §7.3: para un Admin ni siquiera se consulta la query (puede no tener
        // fila de permisos) — mensaje informativo en vez del grid
        <EmptyState
          icon={ShieldCheck}
          title="Acceso completo"
          description="Tienes acceso completo como administrador — no aplican permisos individuales por módulo."
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ALL_MODULES.map((module) => (
            <Skeleton key={module} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ALL_MODULES.map((module) => {
            const { label, icon: ModuleIcon } = MODULE_LABELS[module]
            const active = hasModule(module)
            return (
              <div
                key={module}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    active ? 'bg-accent-tint-bg text-accent-tint-text' : 'bg-surface text-text-faint',
                  )}
                >
                  <ModuleIcon className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{label}</p>
                  <p className={cn('text-xs', active ? 'text-accent-tint-text' : 'text-text-muted')}>
                    {active ? 'Activo' : 'Inactivo'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

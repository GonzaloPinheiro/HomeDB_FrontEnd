import { CircleAlert, ShieldCheck } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle } from 'react'
import { useForm } from 'react-hook-form'

import { toApiError } from '@/shared/api/client'
import { EmptyState } from '@/shared/components/EmptyState'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Switch } from '@/shared/components/ui/switch'
import { MODULE_FLAG, type ModulePermissions } from '@/shared/hooks/usePermissions'
import { ALL_MODULES, MODULE_LABELS } from '@/shared/lib/moduleLabels'
import { cn } from '@/shared/lib/utils'

import { useUpdateUserPermissions, useUserPermissions } from '../api'
import type { TabHandle, TabStatus } from './tabTypes'

type PermissionsTabProps = {
  userId: number
  targetIsAdmin: boolean
  onStatusChange: (status: TabStatus) => void
}

/**
 * CLAUDE.md §5.3/§7.3, aplicado aquí a OTRO usuario en vez de "mí mismo": si
 * el usuario objetivo es Admin, ni siquiera se dispara la query de permisos
 * (puede no tener fila en BD) y se muestra el mismo mensaje que
 * /account/permissions en vez del grid de switches.
 */
export const PermissionsTab = forwardRef<TabHandle, PermissionsTabProps>(function PermissionsTab(
  { userId, targetIsAdmin, onStatusChange },
  ref,
) {
  const query = useUserPermissions(userId, targetIsAdmin)
  const mutation = useUpdateUserPermissions(userId)
  const form = useForm<ModulePermissions>({ values: query.data })

  useEffect(() => {
    onStatusChange({ dirty: form.formState.isDirty, pending: mutation.isPending })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onStatusChange se recrea cada render en el padre, no es una dependencia real
  }, [form.formState.isDirty, mutation.isPending])

  useImperativeHandle(
    ref,
    () => ({
      submit: () =>
        void form.handleSubmit((values) => {
          mutation.mutate(values, { onSuccess: () => form.reset(values) })
        })(),
    }),
    [form, mutation],
  )

  if (targetIsAdmin) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Acceso completo"
        description="Este usuario tiene acceso completo como administrador — no aplican permisos individuales por módulo."
        className="py-8"
      />
    )
  }

  if (query.isPending) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ALL_MODULES.map((module) => (
          <Skeleton key={module} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (query.isError) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="No se pudieron cargar los permisos"
        description={toApiError(query.error).message}
        action={
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="text-sm font-medium text-accent hover:underline"
          >
            Reintentar
          </button>
        }
        className="py-8"
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {ALL_MODULES.map((module) => {
        const { label, icon: ModuleIcon } = MODULE_LABELS[module]
        const flagKey = MODULE_FLAG[module]
        const active = form.watch(flagKey)
        return (
          <label
            key={module}
            htmlFor={`perm-${module}`}
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
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">{label}</p>
            <Switch
              id={`perm-${module}`}
              checked={active}
              onCheckedChange={(checked) => form.setValue(flagKey, checked, { shouldDirty: true })}
            />
          </label>
        )
      })}
    </div>
  )
})

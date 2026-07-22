import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle } from 'react'
import { useForm } from 'react-hook-form'

import { toApiError } from '@/shared/api/client'
import { EmptyState } from '@/shared/components/EmptyState'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'

import { useUpdateUserLimits, useUserLimits } from '../api'
import { formValuesToLimits, limitsFormSchema, limitsToFormValues, type LimitsFormValues } from '../schemas'
import type { TabHandle, TabStatus } from './tabTypes'

type LimitsTabProps = {
  userId: number
  onStatusChange: (status: TabStatus) => void
}

const EMPTY_VALUES: LimitsFormValues = { storageLimitGb: '', maxFileSizeMb: '' }

/**
 * CLAUDE.md §5.4, verificado en UserAdminSettingsService (ver api.ts): a
 * diferencia de Permisos, este PATCH no exige rol Admin, solo el módulo — no
 * hay bypass de Admin aquí, cualquier usuario objetivo (incluido otro Admin)
 * puede tener sus límites editados.
 */
export const LimitsTab = forwardRef<TabHandle, LimitsTabProps>(function LimitsTab(
  { userId, onStatusChange },
  ref,
) {
  const query = useUserLimits(userId)
  const mutation = useUpdateUserLimits(userId)
  const form = useForm<LimitsFormValues>({
    resolver: zodResolver(limitsFormSchema),
    values: query.data ? limitsToFormValues(query.data) : undefined,
    defaultValues: EMPTY_VALUES,
  })

  useEffect(() => {
    onStatusChange({ dirty: form.formState.isDirty, pending: mutation.isPending })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onStatusChange se recrea cada render en el padre, no es una dependencia real
  }, [form.formState.isDirty, mutation.isPending])

  useImperativeHandle(
    ref,
    () => ({
      submit: () =>
        void form.handleSubmit((values) => {
          // §5.4: el PATCH sobreescribe SIEMPRE ambos campos (sin HasValue por
          // propiedad) — se envían los dos juntos, nunca uno solo.
          const limits = formValuesToLimits(values)
          mutation.mutate(limits, { onSuccess: () => form.reset(values) })
        })(),
    }),
    [form, mutation],
  )

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (query.isError) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="No se pudieron cargar los límites"
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
    <Form {...form}>
      <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-5" noValidate>
        <FormField
          control={form.control}
          name="storageLimitGb"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Límite de almacenamiento (GB)</FormLabel>
              <FormControl>
                <Input inputMode="decimal" placeholder="Ej. 10" autoFocus {...field} />
              </FormControl>
              <FormDescription>
                Vacío = sin límite propio, se aplica el límite global del servidor. Un valor por
                encima de ese límite global no tendrá efecto real, aunque se guarde.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="maxFileSizeMb"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tamaño máximo de archivo (MB)</FormLabel>
              <FormControl>
                <Input inputMode="decimal" placeholder="Ej. 500" {...field} />
              </FormControl>
              <FormDescription>
                Vacío = sin límite propio, se aplica el máximo global del servidor. Un valor por
                encima de ese máximo global no tendrá efecto real, aunque se guarde.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
})

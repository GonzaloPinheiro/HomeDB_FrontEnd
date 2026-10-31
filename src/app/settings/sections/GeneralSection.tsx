import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'

import { useAccountSettings, useUpdateAccountSettings } from '@/features/account/api'
import { settingsSchema, type SettingsValues } from '@/features/account/schemas'
import { toApiError } from '@/shared/api/client'
import { Button } from '@/shared/components/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Skeleton } from '@/shared/components/ui/skeleton'

import { useReportDirty } from '../dirty'
import { SettingsCard, SettingsPanel } from '../SettingsLayout'

export function GeneralSection() {
  const settings = useAccountSettings()
  const updateSettings = useUpdateAccountSettings()
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    values: settings.data ?? { language: 'es', timezone: 'UTC' },
  })
  useReportDirty('general', form.formState.isDirty)

  const submit = form.handleSubmit((values) => {
    updateSettings.mutate(values, {
      onSuccess: () => form.reset(values),
    })
  })

  return (
    <SettingsPanel title="General" description="Idioma y zona horaria de tu cuenta.">
      <SettingsCard>
        {settings.isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : settings.data === undefined ? (
          <p className="text-sm text-text-secondary">
            No se pudieron cargar tus ajustes: {toApiError(settings.error).message}
          </p>
        ) : (
          <Form {...form}>
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Idioma</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zona horaria</FormLabel>
                    <FormControl>
                      <Input placeholder="UTC" {...field} />
                    </FormControl>
                    <FormDescription>Ej. UTC, Europe/Madrid</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={updateSettings.isPending || !form.formState.isDirty}
                >
                  {updateSettings.isPending ? <Loader2 className="animate-spin" /> : null}
                  Guardar cambios
                </Button>
              </div>
            </form>
          </Form>
        )}
      </SettingsCard>
    </SettingsPanel>
  )
}

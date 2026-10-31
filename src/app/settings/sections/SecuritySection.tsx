import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'

import { useChangePassword } from '@/features/account/api'
import { changePasswordSchema, type ChangePasswordValues } from '@/features/account/schemas'
import { toApiError } from '@/shared/api/client'
import { ApiErrorCodes } from '@/shared/api/errors'
import { PasswordInput } from '@/shared/components/PasswordInput'
import { Button } from '@/shared/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form'
import { notAvailableYet } from '@/shared/lib/notAvailableYet'

import { useReportDirty } from '../dirty'
import { ComingSoonTag, SettingsCard, SettingsPanel, SettingsRow } from '../SettingsLayout'

export function SecuritySection() {
  const changePassword = useChangePassword()
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { oldPassword: '', newPassword: '' },
  })
  useReportDirty('security', form.formState.isDirty)

  const submit = form.handleSubmit((values) => {
    changePassword.mutate(values, {
      onError: (error) => {
        const apiError = toApiError(error)
        if (apiError.errorCode === ApiErrorCodes.InvalidCredentials) {
          form.setError('oldPassword', { message: 'La contraseña actual no es correcta' })
        } else {
          form.setError('root', { message: apiError.message })
        }
      },
    })
  })

  return (
    <SettingsPanel title="Seguridad" description="Protege el acceso a tu cuenta.">
      <SettingsCard title="Cambiar contraseña">
        <Form {...form}>
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <FormField
              control={form.control}
              name="oldPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña actual</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña nueva</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.formState.errors.root ? (
              <p className="text-sm text-destructive" role="alert">
                {form.formState.errors.root.message}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-end gap-3">
              {/* §5.2: cambiar contraseña revoca todas las sesiones — aviso informativo */}
              <span className="text-xs text-text-muted">Al guardar se cerrará esta sesión.</span>
              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending ? <Loader2 className="animate-spin" /> : null}
                Cambiar contraseña
              </Button>
            </div>
          </form>
        </Form>
      </SettingsCard>

      {/* PENDIENTE (CLAUDE.md §6.20): el backend no tiene segundo factor ni lista de sesiones
          (solo hay refresh tokens por usuario, sin endpoint que los exponga, §5.2). */}
      <SettingsCard>
        <SettingsRow
          title="Verificación en dos pasos"
          description="Añade un segundo paso al iniciar sesión."
          tag={<ComingSoonTag />}
        >
          <Button variant="outline" size="sm" onClick={() => notAvailableYet()}>
            Configurar
          </Button>
        </SettingsRow>
        <SettingsRow
          title="Sesiones activas"
          description="Revisa dónde has iniciado sesión y ciérralas."
          tag={<ComingSoonTag />}
        >
          <Button variant="outline" size="sm" onClick={() => notAvailableYet()}>
            Ver sesiones
          </Button>
        </SettingsRow>
      </SettingsCard>
    </SettingsPanel>
  )
}

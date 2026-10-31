import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Check, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'

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
import { Input } from '@/shared/components/ui/input'
import { useAuth } from '@/shared/hooks/useAuth'

import { loginSchema, type LoginFormValues } from '../schemas'
import { AuthHeading } from './AuthHeading'
import {
  FIELD_CLASS,
  FIELD_LABEL_CLASS,
  LINK_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
  notAvailableYet,
} from './loginShared'

type LoginFormProps = {
  /** Cambia el lado derecho del login a la vista de recuperar la contraseña. */
  onForgotPassword: () => void
}

// CLAUDE.md §6.17: vista "identificarse" del lado derecho del login. Es un fragmento
// (cabecera, aviso y formulario) para que el marco de LoginPage le dé el mismo hueco
// y espaciado que a la vista de recuperar contraseña.
export function LoginForm({ onForgotPassword }: LoginFormProps) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Mensaje informativo de un logout forzado (ej. tras cambiar la contraseña, §5.2)
  const infoMessage = (location.state as { message?: string } | null)?.message

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })

  const mutation = useMutation({
    mutationFn: ({ username, password }: LoginFormValues) => login(username, password),
    onSuccess: () => navigate('/', { replace: true }),
  })

  return (
    <>
      <AuthHeading
        badge="ACCESO PRIVADO"
        title="Identifícate"
        description="Solo las cuentas creadas en este servidor."
      />

      {infoMessage ? (
        <p className="rounded-lg bg-surface px-3 py-2 text-sm text-text-secondary" role="status">
          {infoMessage}
        </p>
      ) : null}

      <Form {...form}>
        <form
          className="flex flex-col gap-[26px]"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          noValidate
        >
          <div className="flex flex-col gap-[18px]">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  {/* El backend solo autentica por username, no por correo (§5.2): la etiqueta del diseño ("Usuario o correo") se queda en "Usuario" */}
                  <FormLabel className={FIELD_LABEL_CLASS}>Usuario</FormLabel>
                  <FormControl>
                    <Input autoComplete="username" autoFocus className={FIELD_CLASS} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-baseline justify-between gap-3">
                    <FormLabel className={FIELD_LABEL_CLASS}>Contraseña</FormLabel>
                    <button
                      type="button"
                      onClick={onForgotPassword}
                      className={`${LINK_BUTTON_CLASS} text-[13px]`}
                    >
                      ¿La has olvidado?
                    </button>
                  </div>
                  <FormControl>
                    {/*
                      CLAUDE.md §11: mostrar/ocultar contraseña en todos los campos de
                      contraseña. Fase 7: antes había un <div> ad-hoc envolviendo el
                      Input aquí — Radix Slot (FormControl) engancha `id`/aria-* en el
                      hijo DIRECTO, así que ese div se quedaba con el id y el <label>
                      (htmlFor) nunca apuntaba al input real (bug de accesibilidad).
                      PasswordInput reenvía esas props al <input> interno vía spread,
                      igual que ya hacían CreateUserModal/AccountSettingsPage.
                    */}
                    <PasswordInput
                      autoComplete="current-password"
                      className={`${FIELD_CLASS} pr-11`}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* PENDIENTE (CLAUDE.md §6.17): el valor no se envía a ningún sitio todavía */}
            <div className="flex items-center justify-between gap-3.5">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text-primary">
                <input type="checkbox" defaultChecked className="peer sr-only" />
                <span className="flex h-[17px] w-[17px] flex-none items-center justify-center rounded border border-text-faint bg-card text-text-on-accent peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100">
                  <Check className="h-[11px] w-[11px]" strokeWidth={3} aria-hidden />
                </span>
                Recordarme
              </label>
              <span className="text-xs text-text-muted">30 días</span>
            </div>
          </div>

          {/* Error de credenciales como texto del formulario, no como toast */}
          {mutation.isError ? (
            <p className="-mt-3 text-sm text-destructive" role="alert">
              {mutation.error.message}
            </p>
          ) : null}

          <div className="flex flex-col gap-3.5">
            {/* CLAUDE.md §11: deshabilitado + estado de carga mientras la mutation está en curso */}
            <Button type="submit" disabled={mutation.isPending} className={PRIMARY_BUTTON_CLASS}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Entrando…
                </>
              ) : (
                'Entrar'
              )}
            </Button>
            {/* PENDIENTE (CLAUDE.md §6.17): passkeys — el backend no las soporta todavía */}
            <Button
              type="button"
              variant="outline"
              onClick={() => notAvailableYet()}
              className="h-auto rounded border-text-faint bg-transparent py-[13px] shadow-none"
            >
              Entrar con clave de acceso
            </Button>
          </div>
        </form>
      </Form>
    </>
  )
}

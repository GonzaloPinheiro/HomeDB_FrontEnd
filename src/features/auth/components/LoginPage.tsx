import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Check, Database, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { PageSkeleton } from '@/shared/components/PageSkeleton'
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
import { env } from '@/shared/env'
import { useAuth } from '@/shared/hooks/useAuth'

import { loginSchema, type LoginFormValues } from '../schemas'
import { LoginShowcase } from './LoginShowcase'

// CLAUDE.md §6.17: campos del login con el estilo del diseño 2b — esquinas casi
// rectas y un borde inferior más grueso que pasa a acento al enfocar.
const FIELD_CLASS =
  'h-auto rounded border-border border-b-2 border-b-text-faint bg-card px-[15px] py-[13px] text-sm shadow-none focus-visible:border-b-accent'
const FIELD_LABEL_CLASS = 'text-[13px] font-medium text-text-primary'
const LINK_BUTTON_CLASS =
  'rounded text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

// Host del servidor al que apunta el front (el que muestra la píldora de la esquina)
const SERVER_HOST = new URL(env.VITE_API_URL).host

// PENDIENTE (CLAUDE.md §6.17): ¿La has olvidado?, Recordarme, "Entrar con clave de
// acceso" y "Otro servidor" son solo maqueta — el backend no tiene recuperación de
// contraseña, sesión persistente ni passkeys (§5.2). Mientras tanto avisan en vez de
// no hacer nada, para que no parezca que el clic se ha perdido.
function notAvailableYet(): void {
  toast.info('Todavía no disponible')
}

export default function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth()
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

  if (isLoading) return <PageSkeleton />
  if (isAuthenticated) return <Navigate to="/" replace />

  return (
    <main className="flex min-h-screen bg-surface-alt">
      <LoginShowcase />

      {/* Columna fija pegada a la derecha desde xl: el diseño de la izquierda se queda con el resto del ancho */}
      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden border-l border-border bg-bg px-6 py-10 sm:px-[54px] xl:w-[680px] xl:flex-none">
        <div
          className="absolute right-0 top-0 h-[260px] w-[260px]"
          style={{ backgroundImage: 'linear-gradient(200deg, var(--surface), transparent 70%)' }}
          aria-hidden
        />

        {/* Estado del servidor: el punto es decorativo por ahora (no hay comprobación de salud real) */}
        <div className="relative flex items-center gap-[9px] self-end rounded-full border border-border bg-card px-3 py-[7px] text-xs text-text-secondary">
          <span className="h-[7px] w-[7px] rounded-full bg-positive-text" aria-hidden />
          <span className="font-mono">{SERVER_HOST}</span>
        </div>

        <div className="relative mx-auto my-auto flex w-full max-w-[400px] flex-col gap-[26px] py-8 xl:mx-0">
          <div className="flex flex-col gap-3.5">
            {/* Sin el panel izquierdo (por debajo de xl) el logo se muestra aquí */}
            <div className="mb-2 flex items-center gap-2.5 xl:hidden">
              <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-accent text-text-on-accent">
                <Database className="h-4 w-4" aria-hidden />
              </div>
              <span className="text-lg font-bold tracking-tight text-text-primary">HomeDB</span>
            </div>

            <span className="self-start rounded-[5px] border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-accent-tint-bg px-[9px] py-[5px] font-mono text-[11px] tracking-[1.4px] text-accent-tint-text">
              ACCESO PRIVADO
            </span>
            <div>
              <h2 className="text-[28px] font-bold tracking-[-0.6px] text-text-primary">
                Identifícate
              </h2>
              <p className="mt-2 text-sm text-text-secondary">
                Solo las cuentas creadas en este servidor.
              </p>
            </div>
          </div>

          {infoMessage ? (
            <p
              className="rounded-lg bg-surface px-3 py-2 text-sm text-text-secondary"
              role="status"
            >
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
                        <Input
                          autoComplete="username"
                          autoFocus
                          className={FIELD_CLASS}
                          {...field}
                        />
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
                          onClick={notAvailableYet}
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
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  className="h-auto rounded bg-text-primary py-[15px] text-[15px] font-semibold text-bg shadow-[5px_5px_0_var(--accent)] hover:bg-text-primary"
                >
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
                  onClick={notAvailableYet}
                  className="h-auto rounded border-text-faint bg-transparent py-[13px] shadow-none"
                >
                  Entrar con clave de acceso
                </Button>
              </div>
            </form>
          </Form>
        </div>

        <div className="relative flex flex-col gap-2 text-xs text-text-muted">
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between gap-4">
            <span>HomeDB · instancia privada</span>
            <button type="button" onClick={notAvailableYet} className={LINK_BUTTON_CLASS}>
              Otro servidor
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

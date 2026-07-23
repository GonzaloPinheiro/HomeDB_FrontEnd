import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

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
import { useAuth } from '@/shared/hooks/useAuth'

import { loginSchema, type LoginFormValues } from '../schemas'

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
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-text-primary">HomeDB</h1>
        <p className="mt-1 text-sm text-text-secondary">Inicia sesión para continuar</p>

        {infoMessage ? (
          <p className="mt-4 rounded-lg bg-surface px-3 py-2 text-sm text-text-secondary" role="status">
            {infoMessage}
          </p>
        ) : null}

        <Form {...form}>
          <form
            className="mt-6 flex flex-col gap-4"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            noValidate
          >
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Usuario</FormLabel>
                  <FormControl>
                    <Input autoComplete="username" autoFocus {...field} />
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
                  <FormLabel>Contraseña</FormLabel>
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
                    <PasswordInput autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Error de credenciales como texto del formulario, no como toast */}
            {mutation.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {mutation.error.message}
              </p>
            ) : null}

            {/* CLAUDE.md §11: deshabilitado + estado de carga mientras la mutation está en curso */}
            <Button type="submit" disabled={mutation.isPending} className="mt-2">
              {mutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Entrando…
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        </Form>
      </div>
    </main>
  )
}

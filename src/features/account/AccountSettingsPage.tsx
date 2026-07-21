import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useBlocker } from 'react-router-dom'
import { toast } from 'sonner'

import { ApiErrorCodes } from '@/shared/api/errors'
import { toApiError } from '@/shared/api/client'
import { Modal } from '@/shared/components/Modal'
import { PasswordInput } from '@/shared/components/PasswordInput'
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
import { useAuth } from '@/shared/hooks/useAuth'
import { getThemePreference, setThemePreference, type ThemePreference } from '@/shared/lib/theme'
import { cn } from '@/shared/lib/utils'

import { useAccountSettings, useChangePassword, useUpdateAccountSettings, useUpdateProfile } from './api'
import {
  changePasswordSchema,
  profileSchema,
  settingsSchema,
  type ChangePasswordValues,
  type ProfileValues,
  type SettingsValues,
} from './schemas'

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 text-base font-semibold text-text-primary">{title}</h2>
      {children}
    </section>
  )
}

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'auto', label: 'Automático', icon: Monitor },
]

export default function AccountSettingsPage() {
  const { claims } = useAuth()

  // --- Perfil ---
  const updateProfile = useUpdateProfile()
  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: { username: claims?.username ?? '', email: '' },
  })

  const submitProfile = profileForm.handleSubmit((values) => {
    // Solo los campos modificados (ver nota en useUpdateProfile): reenviar el
    // username actual sin cambios fallaría con 1007
    const changes: { username?: string; email?: string } = {}
    if (values.username !== claims?.username) changes.username = values.username
    if (values.email !== '') changes.email = values.email
    if (Object.keys(changes).length === 0) return

    updateProfile.mutate(changes, {
      onSuccess: () => {
        toast.success('Perfil actualizado')
        profileForm.reset({ username: profileForm.getValues('username'), email: '' })
      },
      onError: (error) => {
        // 1007/1011 junto al campo correspondiente, no como toast (patrón del login)
        const apiError = toApiError(error)
        if (apiError.errorCode === ApiErrorCodes.UserAlreadyExists) {
          profileForm.setError('username', { message: apiError.message })
        } else if (apiError.errorCode === ApiErrorCodes.EmailAlreadyExists) {
          profileForm.setError('email', { message: apiError.message })
        } else {
          profileForm.setError('root', { message: apiError.message })
        }
      },
    })
  })

  // --- Contraseña ---
  const changePassword = useChangePassword()
  const passwordForm = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { oldPassword: '', newPassword: '' },
  })

  const submitPassword = passwordForm.handleSubmit((values) => {
    changePassword.mutate(values, {
      onError: (error) => {
        const apiError = toApiError(error)
        if (apiError.errorCode === ApiErrorCodes.InvalidCredentials) {
          passwordForm.setError('oldPassword', { message: 'La contraseña actual no es correcta' })
        } else {
          passwordForm.setError('root', { message: apiError.message })
        }
      },
    })
  })

  // --- Preferencias (idioma/timezone) ---
  const settings = useAccountSettings()
  const updateSettings = useUpdateAccountSettings()
  const settingsForm = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    values: settings.data ?? { language: 'es', timezone: 'UTC' },
  })

  const submitSettings = settingsForm.handleSubmit((values) => {
    updateSettings.mutate(values, {
      onSuccess: () => settingsForm.reset(values),
    })
  })

  // --- Tema (§6.1): se aplica al instante, escribe donde lee la lógica de Fase 0 ---
  const [theme, setTheme] = useState<ThemePreference>(() => getThemePreference())
  const selectTheme = (preference: ThemePreference) => {
    setThemePreference(preference)
    setTheme(preference)
  }

  // --- Aviso de cambios sin guardar (§11), generalizado a la página completa ---
  const isDirty =
    profileForm.formState.isDirty ||
    passwordForm.formState.isDirty ||
    settingsForm.formState.isDirty
  const blocker = useBlocker(isDirty)

  useEffect(() => {
    if (!isDirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold text-text-primary">Ajustes</h1>

      <SectionCard title="Perfil">
        <Form {...profileForm}>
          <form onSubmit={submitProfile} className="flex flex-col gap-4" noValidate>
            <FormField
              control={profileForm.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de usuario</FormLabel>
                  <FormControl>
                    <Input autoComplete="username" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={profileForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" placeholder="Escribe un email para cambiarlo" {...field} />
                  </FormControl>
                  {/* No hay endpoint para leer el email actual (§5.4) — vacío = sin cambios */}
                  <FormDescription>Déjalo vacío para no cambiar el email actual.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {profileForm.formState.errors.root ? (
              <p className="text-sm text-destructive" role="alert">
                {profileForm.formState.errors.root.message}
              </p>
            ) : null}
            <div className="flex justify-end">
              <Button type="submit" disabled={updateProfile.isPending || !profileForm.formState.isDirty}>
                {updateProfile.isPending ? <Loader2 className="animate-spin" /> : null}
                Guardar perfil
              </Button>
            </div>
          </form>
        </Form>
      </SectionCard>

      <SectionCard title="Contraseña">
        <Form {...passwordForm}>
          <form onSubmit={submitPassword} className="flex flex-col gap-4" noValidate>
            <FormField
              control={passwordForm.control}
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
              control={passwordForm.control}
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
            {passwordForm.formState.errors.root ? (
              <p className="text-sm text-destructive" role="alert">
                {passwordForm.formState.errors.root.message}
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-3">
              {/* §5.2: cambiar contraseña revoca todas las sesiones — aviso informativo */}
              <span className="text-xs text-text-muted">Al guardar se cerrará esta sesión.</span>
              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending ? <Loader2 className="animate-spin" /> : null}
                Cambiar contraseña
              </Button>
            </div>
          </form>
        </Form>
      </SectionCard>

      <SectionCard title="Preferencias">
        {settings.isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : settings.isError ? (
          <p className="text-sm text-text-secondary">
            No se pudieron cargar tus ajustes: {toApiError(settings.error).message}
          </p>
        ) : (
          <Form {...settingsForm}>
            <form onSubmit={submitSettings} className="flex flex-col gap-4" noValidate>
              <FormField
                control={settingsForm.control}
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
                control={settingsForm.control}
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
                <Button type="submit" disabled={updateSettings.isPending || !settingsForm.formState.isDirty}>
                  {updateSettings.isPending ? <Loader2 className="animate-spin" /> : null}
                  Guardar preferencias
                </Button>
              </div>
            </form>
          </Form>
        )}

        {/* Tema: se aplica al momento, sin botón de guardar (vive solo en el dispositivo, §6.1) */}
        <div className="mt-6 border-t border-border-light pt-4">
          <p className="mb-2 text-sm font-medium text-text-primary">Tema</p>
          <div className="flex gap-2" role="group" aria-label="Tema de la interfaz">
            {THEME_OPTIONS.map(({ value, label, icon: OptionIcon }) => (
              <button
                key={value}
                type="button"
                onClick={() => selectTheme(value)}
                aria-pressed={theme === value}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                  theme === value
                    ? 'border-accent bg-accent-tint-bg font-medium text-accent-tint-text'
                    : 'border-border text-text-secondary hover:bg-surface-alt hover:text-text-primary',
                )}
              >
                <OptionIcon className="h-4 w-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Automático sigue la preferencia del sistema. Se guarda solo en este dispositivo.
          </p>
        </div>
      </SectionCard>

      {/* §11: confirmación antes de descartar cambios sin guardar */}
      <Modal
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.()
        }}
        title="Cambios sin guardar"
        size="small"
        footer={
          <>
            <Button variant="outline" onClick={() => blocker.reset?.()}>
              Seguir editando
            </Button>
            <Button variant="destructive" onClick={() => blocker.proceed?.()}>
              Salir sin guardar
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          Tienes cambios sin guardar en esta página. Si sales ahora, se perderán.
        </p>
      </Modal>
    </div>
  )
}

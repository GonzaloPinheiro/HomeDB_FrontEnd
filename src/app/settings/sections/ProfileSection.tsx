import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { useMyProfile, useUpdateProfile } from '@/features/account/api'
import { profileSchema, type ProfileValues } from '@/features/account/schemas'
import { toApiError } from '@/shared/api/client'
import { ApiErrorCodes } from '@/shared/api/errors'
import { RoleBadge } from '@/shared/components/RoleBadge'
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar'
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
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useAuth } from '@/shared/hooks/useAuth'
import { formatShortDate } from '@/shared/lib/formatDate'
import { notAvailableYet } from '@/shared/lib/notAvailableYet'

import { useReportDirty } from '../dirty'
import { SettingsCard, SettingsPanel } from '../SettingsLayout'

export function ProfileSection() {
  const { claims } = useAuth()
  // GET /users/me permite precargar los valores reales en vez de asumir "vacío = no
  // cambiar" (§5.4).
  const profile = useMyProfile()
  const updateProfile = useUpdateProfile()
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: profile.data
      ? { username: profile.data.username, email: profile.data.email }
      : undefined,
    defaultValues: { username: '', email: '' },
  })
  useReportDirty('profile', form.formState.isDirty)

  const submit = form.handleSubmit((values) => {
    // Solo los campos REALMENTE modificados, comparados contra el valor cargado por
    // GET /users/me (no contra el claim del JWT, que podría estar desactualizado):
    // reenviar sin cambios fallaría con 1007/1011 (ver useUpdateProfile — el backend no
    // excluye al propio usuario del chequeo de unicidad).
    const changes: { username?: string; email?: string } = {}
    if (values.username !== profile.data?.username) changes.username = values.username
    if (values.email !== profile.data?.email) changes.email = values.email
    if (Object.keys(changes).length === 0) return

    updateProfile.mutate(changes, {
      onSuccess: () => {
        toast.success('Perfil actualizado')
        form.reset(values)
      },
      onError: (error) => {
        // 1007/1011 junto al campo correspondiente, no como toast (patrón del login)
        const apiError = toApiError(error)
        if (apiError.errorCode === ApiErrorCodes.UserAlreadyExists) {
          form.setError('username', { message: apiError.message })
        } else if (apiError.errorCode === ApiErrorCodes.EmailAlreadyExists) {
          form.setError('email', { message: apiError.message })
        } else {
          form.setError('root', { message: apiError.message })
        }
      },
    })
  })

  const username = claims?.username ?? ''

  return (
    <SettingsPanel title="Perfil" description="Cómo apareces en HomeDB.">
      <SettingsCard>
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-accent-tint-bg text-lg font-semibold text-accent-tint-text">
              {username.slice(0, 2).toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-text-primary">{username}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
              {claims ? <RoleBadge role={claims.role} /> : null}
              {profile.data ? (
                <span>Miembro desde {formatShortDate(profile.data.createdAt)}</span>
              ) : null}
            </div>
          </div>
          {/* PENDIENTE (CLAUDE.md §6.20): no hay foto de perfil en el backend */}
          <Button variant="outline" size="sm" onClick={() => notAvailableYet()}>
            Cambiar foto
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard title="Datos de la cuenta">
        {profile.isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : profile.data === undefined ? (
          // §7.1: se decide por `data`, no por `isError` — un refetch fallido no oculta lo ya cargado
          <p className="text-sm text-text-secondary">
            No se pudo cargar tu perfil: {toApiError(profile.error).message}
          </p>
        ) : (
          <Form {...form}>
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              <FormField
                control={form.control}
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
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo electrónico</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" {...field} />
                    </FormControl>
                    <FormDescription>Sirve para recuperar el acceso a tu cuenta.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root ? (
                <p className="text-sm text-destructive" role="alert">
                  {form.formState.errors.root.message}
                </p>
              ) : null}
              <div className="flex justify-end">
                <Button type="submit" disabled={updateProfile.isPending || !form.formState.isDirty}>
                  {updateProfile.isPending ? <Loader2 className="animate-spin" /> : null}
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

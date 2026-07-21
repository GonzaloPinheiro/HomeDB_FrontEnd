import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'

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

import { useCreateUser } from '../api'
import { createUserSchema, type CreateUserValues } from '../schemas'

type CreateUserModalProps = {
  open: boolean
  onClose: () => void
}

// CLAUDE.md §5.2/§6.4: "Nuevo usuario" — modal pequeño, username + contraseña
// (sin email: RegisterDto no lo admite, §5.4). El usuario nace como User sin
// ningún módulo activo (§5.3).
export function CreateUserModal({ open, onClose }: CreateUserModalProps) {
  const mutation = useCreateUser()
  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { username: '', password: '' },
  })

  const close = () => {
    form.reset()
    onClose()
  }

  const submit = form.handleSubmit((values) => {
    mutation.mutate(values, {
      onSuccess: close,
      onError: (error) => {
        const apiError = toApiError(error)
        if (apiError.errorCode === ApiErrorCodes.UserAlreadyExists) {
          form.setError('username', { message: apiError.message })
        } else {
          form.setError('root', { message: apiError.message })
        }
      },
    })
  })

  return (
    <Modal open={open} onOpenChange={(value) => !value && close()} title="Nuevo usuario" size="small">
      <Form {...form}>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre de usuario</FormLabel>
                <FormControl>
                  <Input autoFocus autoComplete="off" {...field} />
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
                  {/* CLAUDE.md §11: ojo de mostrar/ocultar en todos los campos de contraseña */}
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <FormDescription>
                  El usuario nuevo no tendrá ningún módulo activado hasta que se le asignen permisos.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.formState.errors.root ? (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.root.message}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              Crear usuario
            </Button>
          </div>
        </form>
      </Form>
    </Modal>
  )
}

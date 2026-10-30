import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'

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

import { recoverPasswordSchema, type RecoverPasswordValues } from '../schemas'
import { AuthHeading } from './AuthHeading'
import {
  FIELD_CLASS,
  FIELD_LABEL_CLASS,
  LINK_BUTTON_CLASS,
  PRIMARY_BUTTON_CLASS,
  notAvailableYet,
} from './loginShared'

type RecoverPasswordFormProps = {
  /** Vuelve a la vista de identificarse. */
  onBack: () => void
}

// CLAUDE.md §6.17: vista "recuperar contraseña" del lado derecho del login. Sustituye a
// la de identificarse en el mismo hueco (el panel de la izquierda no cambia).
//
// PENDIENTE (CLAUDE.md §6.17): maqueta. El backend aún no tiene recuperación de
// contraseña (verificado octubre 2026: ni `forgotPassword` ni `resetPassword` en
// AuthController). El plan del Notion (v1.1) es `POST /auth/forgotPassword`, anónimo y
// con rate limit, que responde SIEMPRE lo mismo exista o no el correo, y un
// `POST /auth/resetPassword` con el token del enlace. Al llegar: verificar su forma real
// (§2), sustituir el aviso de `onSubmit` por la mutation y mostrar la respuesta genérica
// ("si el correo existe, recibirás un mensaje") sin revelar si la cuenta existe.
export function RecoverPasswordForm({ onBack }: RecoverPasswordFormProps) {
  const form = useForm<RecoverPasswordValues>({
    resolver: zodResolver(recoverPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = form.handleSubmit(() => {
    notAvailableYet('Recuperar la contraseña aún está en desarrollo')
  })

  return (
    <>
      <AuthHeading
        badge="RECUPERAR ACCESO"
        title="Recupera tu contraseña"
        description="Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva."
      />

      <Form {...form}>
        <form className="flex flex-col gap-[26px]" onSubmit={onSubmit} noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={FIELD_LABEL_CLASS}>Correo electrónico</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoFocus
                    className={FIELD_CLASS}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-col gap-3.5">
            <Button type="submit" className={PRIMARY_BUTTON_CLASS}>
              Enviar enlace
            </Button>
            <button
              type="button"
              onClick={onBack}
              className={`${LINK_BUTTON_CLASS} flex items-center justify-center gap-1.5 py-1 text-sm`}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Volver a identificarse
            </button>
          </div>
        </form>
      </Form>
    </>
  )
}

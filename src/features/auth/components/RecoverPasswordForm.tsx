import { ArrowLeft } from 'lucide-react'
import type { FormEvent } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'

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
// AuthController), así que el botón solo avisa de que está en desarrollo — sin validar
// el correo ni llamar a ningún endpoint. El plan del Notion (v1.1) es
// `POST /auth/forgotPassword`, anónimo y con rate limit, que responde SIEMPRE lo mismo
// exista o no el correo, y un `POST /auth/resetPassword` con el token del enlace. Al
// llegar: verificar su forma real (§2), añadir el schema del correo (vacío ≠ mal
// formado), la mutation, y mostrar la respuesta genérica ("si el correo existe,
// recibirás un mensaje") sin revelar si la cuenta existe.
export function RecoverPasswordForm({ onBack }: RecoverPasswordFormProps) {
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    notAvailableYet('Recuperar la contraseña aún está en desarrollo')
  }

  return (
    <>
      <AuthHeading
        badge="RECUPERAR ACCESO"
        title="Recupera tu contraseña"
        description="Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva."
      />

      <form className="flex flex-col gap-[26px]" onSubmit={onSubmit} noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="recover-email" className={FIELD_LABEL_CLASS}>
            Correo electrónico
          </Label>
          <Input
            id="recover-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            className={FIELD_CLASS}
          />
        </div>

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
    </>
  )
}

import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useState, type ComponentProps } from 'react'

import { Input } from '@/shared/components/ui/input'
import { cn } from '@/shared/lib/utils'

// CLAUDE.md §11: mostrar/ocultar contraseña (icono de ojo) en TODOS los campos
// de contraseña de la app.
export const PasswordInput = forwardRef<HTMLInputElement, ComponentProps<'input'>>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false)
    return (
      <div className="relative">
        <Input ref={ref} type={visible ? 'text' : 'password'} className={cn('pr-10', className)} {...props} />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-text-muted hover:text-text-primary"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      </div>
    )
  },
)
PasswordInput.displayName = 'PasswordInput'

import { toast } from 'sonner'

// CLAUDE.md §6.17: estilos y avisos que comparten las dos vistas del lado derecho
// del login (identificarse y recuperar la contraseña).

// Campos con el estilo del diseño 2b — esquinas casi rectas y un borde inferior más
// grueso que pasa a acento al enfocar.
export const FIELD_CLASS =
  'h-auto rounded border-border border-b-2 border-b-text-faint bg-card px-[15px] py-[13px] text-sm shadow-none focus-visible:border-b-accent'
export const FIELD_LABEL_CLASS = 'text-[13px] font-medium text-text-primary'
export const LINK_BUTTON_CLASS =
  'rounded text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

// Botón principal del diseño: tinta (se invierte sola en oscuro) con sombra dura de acento.
export const PRIMARY_BUTTON_CLASS =
  'h-auto rounded bg-text-primary py-[15px] text-[15px] font-semibold text-bg shadow-[5px_5px_0_var(--accent)] hover:bg-text-primary'

// PENDIENTE (CLAUDE.md §6.17): lo que el backend aún no soporta (recordarme, passkeys,
// otro servidor, recuperar contraseña) es solo maqueta. Mientras tanto avisa en vez de
// no hacer nada, para que no parezca que el clic se ha perdido.
export function notAvailableYet(message = 'Todavía no disponible'): void {
  toast.info(message)
}

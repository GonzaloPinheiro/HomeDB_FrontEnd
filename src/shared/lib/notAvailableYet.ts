import { toast } from 'sonner'

// Aviso estándar de la app para lo que está en la interfaz pero aún no funciona
// (el login, la cabecera y los ajustes lo usan): mejor que un clic sin respuesta,
// que parecería un fallo. Misma redacción en todas partes.
export function notAvailableYet(): void {
  toast.info('Todavía no disponible')
}

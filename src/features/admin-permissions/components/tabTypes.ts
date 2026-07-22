// Contrato entre UserDetailModal (orquestador) y cada pestaña editable
// (Permisos, Límites). Perfil no lo implementa: es de solo lectura, no tiene
// nada que guardar ni descartar (§6.8).
export type TabStatus = {
  dirty: boolean
  pending: boolean
}

export type TabHandle = {
  /** Envía el formulario de la pestaña (llamado desde el botón "Guardar" del pie del modal). */
  submit: () => void
}

// CLAUDE.md §6.22: modelo de dominio de la VPN (WireGuard vía PiVPN). El backend NO tiene
// todavía ningún endpoint de esto (noviembre 2026): este contrato sale del diseño planificado
// en el Notion ("Mejoras futuras" -> "Gestión de dispositivos VPN") y del diseño de la
// pantalla, no de código verificado. Los campos marcados SUGERENCIA no están en el Notion:
// la pantalla los necesita y se añadieron para que la maqueta sea realista.
// PENDIENTE (CLAUDE.md §6.22): cuando exista el backend, releer su código real y ajustar estos
// tipos; añadir entonces `schemas.ts` (Zod) con la forma de wire real y derivar los tipos de ahí.

export type VpnDevice = {
  /** Clave pública de WireGuard: el identificador lógico del dispositivo (base64, 44 caracteres). */
  publicKey: string
  name: string
  assignedIp: string
  /** Handshake reciente (menos de ~3 min). Lo decide el backend al generar la lectura. */
  isActive: boolean
  /** ISO. `null` = el dispositivo nunca se ha conectado. */
  lastHandshakeAt: string | null
  /** IP pública y puerto de la última conexión. `null` si nunca se ha conectado. */
  endpoint: string | null
  /** Acumulado desde que arrancó la interfaz de WireGuard (se reinicia con ella), no histórico. */
  bytesReceived: number
  bytesSent: number
  /** Id de un usuario de HomeDB. Solo se guarda en HomeDB (`VpnDeviceMetadata`), no en WireGuard. */
  ownerId: number | null
  ownerName: string | null
  notes: string | null
  /**
   * SUGERENCIA (no está en el Notion): ISO de cuándo se pidió revocar este dispositivo, si la
   * revocación sigue sin completarse. La revocación es asíncrona (202): sin este campo la
   * pantalla solo puede recordar «Revocando…» en memoria, y al recargar la página el
   * dispositivo volvería a verse como normal y se podría pedir revocar otra vez.
   */
  revocationRequestedAt: string | null
}

/** Una lectura completa de la VPN. */
export type VpnSnapshot = {
  /**
   * SUGERENCIA (no está en el Notion): ISO de cuándo se generó la lectura de WireGuard (la fecha
   * del fichero que deja el temporizador del host). Sin ella no se puede saber si los datos
   * están desactualizados porque el temporizador se haya parado.
   */
  snapshotAt: string
  devices: VpnDevice[]
}

/** Un usuario de HomeDB al que se puede asignar un dispositivo. */
export type VpnOwner = { id: number; name: string }

/**
 * Código de error PROVISIONAL: no existe en el backend ni en `shared/api/errors.ts` (que solo
 * recoge los reales). Se define aquí, dentro de la feature, a propósito. Significa que HomeDB no
 * ha podido leer el estado de WireGuard (falta el fichero que deja el host, o no es legible).
 * PENDIENTE (CLAUDE.md §5.4): sustituir por el valor real de `ApiErrorCodes`. Los errores de las
 * ESCRITURAS (404 al revocar un dispositivo que ya no existe, 429 del límite propio de revocar)
 * no se mockean porque las escrituras no están conectadas; se añadirán con sus mutations.
 */
export const VPN_ERROR_CODES = {
  Unavailable: 1031,
} as const

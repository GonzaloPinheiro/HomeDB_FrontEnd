import type { BlockedService } from './types'

// CLAUDE.md §6.21: servicios bloqueados. Los interruptores NO se envían uno a uno:
// se acumulan como cambios pendientes y se guardan juntos (`PUT /adblocker/blocked-services`
// recibe la lista completa de ids bloqueados). Este módulo es esa lógica de "pendientes".

/** id del servicio -> estado deseado, SOLO para los que difieren de lo guardado. */
export type PendingChanges = Readonly<Record<string, boolean>>

export function isServiceBlocked(service: BlockedService, pending: PendingChanges): boolean {
  return service.id in pending ? pending[service.id] : service.blocked
}

/** Invierte un servicio; si vuelve a su valor guardado, deja de ser un cambio pendiente. */
export function togglePending(pending: PendingChanges, service: BlockedService): PendingChanges {
  const next = { ...pending }
  const desired = !isServiceBlocked(service, pending)
  if (desired === service.blocked) delete next[service.id]
  else next[service.id] = desired
  return next
}

export function countPending(pending: PendingChanges): number {
  return Object.keys(pending).length
}

export function describePending(count: number): string {
  return count === 1 ? '1 cambio sin guardar' : `${count} cambios sin guardar`
}

/** Cuántos servicios quedarían bloqueados si se aplicasen los cambios pendientes. */
export function countBlocked(services: readonly BlockedService[], pending: PendingChanges): number {
  return services.filter((service) => isServiceBlocked(service, pending)).length
}

/**
 * Filtra por nombre (sin distinguir mayúsculas) y, opcionalmente, solo los bloqueados.
 * "Solo bloqueados" cuenta el estado EFECTIVO (con los pendientes): si quitas uno y la
 * lista se reordena bajo el cursor, el usuario perdería de vista lo que acaba de tocar.
 * Por eso un servicio con cambio pendiente sigue visible hasta que se guarde o descarte.
 */
export function filterServices(
  services: readonly BlockedService[],
  pending: PendingChanges,
  query: string,
  onlyBlocked: boolean,
): BlockedService[] {
  const needle = query.trim().toLowerCase()
  return services.filter((service) => {
    if (needle !== '' && !service.name.toLowerCase().includes(needle)) return false
    if (!onlyBlocked) return true
    return isServiceBlocked(service, pending) || service.id in pending
  })
}

/** Inicial para el avatar del servicio ("9GAG" -> "9", "(X) Twitter" -> "X"). */
export function getServiceInitial(name: string): string {
  const match = /[A-Za-z0-9]/.exec(name)
  return match ? match[0].toUpperCase() : '?'
}

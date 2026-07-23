/**
 * CLAUDE.md §5.4 (hallazgo de Fase 5): `GET /admin/logs` y `GET /admin/audit-logs`
 * fallan con 500 (`Cannot write DateTimeOffset with Offset=... to PostgreSQL
 * type 'timestamp with time zone'`) si `From`/`To` llegan como fecha "pelada"
 * (`"2026-07-01"`, el valor literal de un `<input type="date">`) — ASP.NET la
 * interpreta como `DateTimeOffset` con el offset LOCAL del servidor, y
 * `LogEntryRepository`/`AuditLogEntryRepository` pasan ese valor a Npgsql sin
 * normalizar a UTC (a diferencia de `UserRepository`, que sí llama a
 * `.UtcDateTime` antes de filtrar — por eso `/admin/users?from=` no falla).
 * Es un bug del backend, pero el front controla el formato que envía: anclar
 * explícitamente a UTC con sufijo `Z` evita disparar el bug sin necesidad de
 * esperar un fix del backend (a diferencia del bug de refresh token, §5.2,
 * donde el front no puede hacer nada).
 */
export function toUtcDayStart(date: string): string {
  return `${date}T00:00:00Z`
}

export function toUtcDayEnd(date: string): string {
  return `${date}T23:59:59Z`
}

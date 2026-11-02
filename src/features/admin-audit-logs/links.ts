/**
 * Ruta de Auditoría filtrada por un usuario exacto (CLAUDE.md §6.24). La usa el enlace "Ver actividad" de
 * Usuarios: vive junto a `parseAuditFilters` (que lee ese `userId`) para que el enlace y su lectura no
 * puedan divergir; `links.test.ts` comprueba que lo que se genera aquí es lo que se lee allí.
 */
export function auditLogsPathForUser(userId: number): string {
  return `/admin/audit-logs?userId=${userId}`
}

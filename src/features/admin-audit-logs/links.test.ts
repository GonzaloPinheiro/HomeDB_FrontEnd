import { describe, expect, it } from 'vitest'

import { parseAuditFilters } from './filters'
import { auditLogsPathForUser } from './links'

describe('auditLogsPathForUser', () => {
  it('apunta a la ruta de Auditoría', () => {
    expect(auditLogsPathForUser(5).startsWith('/admin/audit-logs?')).toBe(true)
  })

  it('lo que genera es exactamente lo que parseAuditFilters lee (el enlace no puede divergir de su lectura)', () => {
    const search = auditLogsPathForUser(42).split('?')[1]
    expect(parseAuditFilters(new URLSearchParams(search)).userId).toBe(42)
  })
})

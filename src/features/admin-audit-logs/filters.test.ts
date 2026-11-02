import { describe, expect, it } from 'vitest'

import { EMPTY_AUDIT_FILTERS } from './api'
import { parseAuditFilters } from './filters'

const params = (query: string) => new URLSearchParams(query)

describe('parseAuditFilters', () => {
  it('sin parámetros -> filtros vacíos', () => {
    expect(parseAuditFilters(params(''))).toEqual(EMPTY_AUDIT_FILTERS)
  })

  it('lee cada filtro de la URL, con el userId como número', () => {
    expect(
      parseAuditFilters(
        params('userName=ana&userId=5&action=LOGIN&resourceType=FileItem&from=2026-11-01&to=2026-11-05'),
      ),
    ).toEqual({
      userName: 'ana',
      userId: 5,
      action: 'LOGIN',
      resourceType: 'FileItem',
      from: '2026-11-01',
      to: '2026-11-05',
    })
  })

  it.each(['abc', '0', '-3', '2.5', ''])('un userId inválido (%j) se ignora en vez de llegar al backend', (value) => {
    expect(parseAuditFilters(params(`userId=${value}`)).userId).toBeNull()
  })

  it('un parámetro vacío cuenta como ausente', () => {
    expect(parseAuditFilters(params('action=&from='))).toEqual(EMPTY_AUDIT_FILTERS)
  })
})

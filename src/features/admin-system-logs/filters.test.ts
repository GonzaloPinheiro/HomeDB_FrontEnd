import { describe, expect, it } from 'vitest'

import { EMPTY_LOGS_FILTERS } from './api'
import { parseLogsFilters } from './filters'

const params = (query: string) => new URLSearchParams(query)

describe('parseLogsFilters', () => {
  it('sin parámetros -> filtros vacíos', () => {
    expect(parseLogsFilters(params(''))).toEqual(EMPTY_LOGS_FILTERS)
  })

  it('lee cada filtro de la URL', () => {
    expect(
      parseLogsFilters(params('level=Error&operation=GetFiles&from=2026-10-01&to=2026-10-31&correlationId=abc')),
    ).toEqual({
      level: 'Error',
      operation: 'GetFiles',
      from: '2026-10-01',
      to: '2026-10-31',
      correlationId: 'abc',
    })
  })

  it('un parámetro vacío cuenta como ausente (no se envía "level=" al backend)', () => {
    expect(parseLogsFilters(params('level=&from=&correlationId='))).toEqual(EMPTY_LOGS_FILTERS)
  })

  it('ignora los parámetros que no son filtros', () => {
    expect(parseLogsFilters(params('settings=profile&page=3'))).toEqual(EMPTY_LOGS_FILTERS)
  })
})

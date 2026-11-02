import { describe, expect, it } from 'vitest'

import { EMPTY_LOGS_FILTERS } from './api'
import { countActiveFilters, parseLogsFilters, parsePage, patchParams, replaceFilterParams } from './filters'

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

describe('parsePage', () => {
  it('por defecto es la 1', () => {
    expect(parsePage(params(''))).toBe(1)
  })

  it('lee un entero válido', () => {
    expect(parsePage(params('page=4'))).toBe(4)
  })

  it.each(['0', '-3', 'abc', '', 'NaN', 'Infinity'])('el valor %j se corrige a la 1', (value) => {
    expect(parsePage(params(`page=${value}`))).toBe(1)
  })

  it('un decimal se trunca', () => {
    expect(parsePage(params('page=2.7'))).toBe(2)
  })
})

describe('countActiveFilters', () => {
  it('cuenta solo los filtros con valor', () => {
    expect(countActiveFilters(EMPTY_LOGS_FILTERS)).toBe(0)
    expect(countActiveFilters({ ...EMPTY_LOGS_FILTERS, level: 'Warning', operation: 'x' })).toBe(2)
  })
})

describe('patchParams', () => {
  it('pone, cambia y borra parámetros sin tocar el resto', () => {
    const next = patchParams(params('level=Warning&settings=profile'), { level: 'Error', from: '2026-10-01' })
    expect(next.get('level')).toBe('Error')
    expect(next.get('from')).toBe('2026-10-01')
    expect(next.get('settings')).toBe('profile')
  })

  it('null y cadena vacía borran el parámetro', () => {
    const next = patchParams(params('level=Warning&operation=x'), { level: null, operation: '' })
    expect(next.has('level')).toBe(false)
    expect(next.has('operation')).toBe(false)
  })

  it('no modifica el original', () => {
    const original = params('level=Warning')
    patchParams(original, { level: 'Error' })
    expect(original.get('level')).toBe('Warning')
  })
})

describe('replaceFilterParams', () => {
  it('descarta los filtros y la página anteriores: la vista es EXACTAMENTE la pedida', () => {
    const next = replaceFilterParams(params('level=Warning&from=2026-10-01&correlationId=abc&page=5'), {
      level: 'Critical',
      operation: 'UploadChunkAsync()',
    })
    expect(parseLogsFilters(next)).toEqual({
      ...EMPTY_LOGS_FILTERS,
      level: 'Critical',
      operation: 'UploadChunkAsync()',
    })
    expect(next.has('page')).toBe(false)
  })

  it('con un objeto vacío limpia todos los filtros', () => {
    const next = replaceFilterParams(params('level=Warning&operation=x&page=2'), {})
    expect(parseLogsFilters(next)).toEqual(EMPTY_LOGS_FILTERS)
    expect(next.has('page')).toBe(false)
  })

  it('conserva los parámetros que no son de esta tabla', () => {
    const next = replaceFilterParams(params('settings=security&level=Warning'), {})
    expect(next.get('settings')).toBe('security')
  })

  it('ignora valores undefined, null y vacíos', () => {
    const next = replaceFilterParams(params(''), { level: undefined, from: null, to: '' })
    expect(next.toString()).toBe('')
  })
})

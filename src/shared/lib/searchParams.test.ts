import { describe, expect, it } from 'vitest'

import { parsePageParam, patchParams, readIntParam, readParam, replaceParams, serializeParam } from './searchParams'

const params = (query: string) => new URLSearchParams(query)

describe('readParam', () => {
  it('lee el valor, y un parámetro vacío o ausente es null', () => {
    expect(readParam(params('level=Error'), 'level')).toBe('Error')
    expect(readParam(params('level='), 'level')).toBeNull()
    expect(readParam(params(''), 'level')).toBeNull()
  })
})

describe('readIntParam', () => {
  it('lee un entero positivo', () => {
    expect(readIntParam(params('userId=5'), 'userId')).toBe(5)
  })

  it.each(['0', '-2', 'abc', '2.5', '', '1e3x'])('el valor %j no es un id válido -> null', (value) => {
    expect(readIntParam(params(`userId=${value}`), 'userId')).toBeNull()
  })

  it('ausente -> null', () => {
    expect(readIntParam(params(''), 'userId')).toBeNull()
  })
})

describe('parsePageParam', () => {
  it('por defecto es la 1', () => {
    expect(parsePageParam(params(''))).toBe(1)
  })

  it('lee un entero válido', () => {
    expect(parsePageParam(params('page=4'))).toBe(4)
  })

  it.each(['0', '-3', 'abc', '', 'NaN', 'Infinity'])('el valor %j se corrige a la 1', (value) => {
    expect(parsePageParam(params(`page=${value}`))).toBe(1)
  })

  it('un decimal se trunca', () => {
    expect(parsePageParam(params('page=2.7'))).toBe(2)
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

describe('replaceParams', () => {
  const KEYS = ['level', 'operation', 'from']

  it('deja los parámetros de la tabla EXACTAMENTE como se piden y borra la página', () => {
    const next = replaceParams(params('level=Warning&from=2026-10-01&page=5'), KEYS, {
      level: 'Critical',
      operation: 'UploadChunkAsync()',
    })
    expect(next.get('level')).toBe('Critical')
    expect(next.get('operation')).toBe('UploadChunkAsync()')
    expect(next.has('from')).toBe(false)
    expect(next.has('page')).toBe(false)
  })

  it('con un objeto vacío limpia todos los parámetros de la tabla', () => {
    const next = replaceParams(params('level=Warning&operation=x&page=2'), KEYS, {})
    expect(next.toString()).toBe('')
  })

  it('conserva los parámetros que no son de la tabla', () => {
    const next = replaceParams(params('settings=security&level=Warning'), KEYS, {})
    expect(next.get('settings')).toBe('security')
  })

  it('ignora valores undefined, null y vacíos', () => {
    expect(replaceParams(params(''), KEYS, { level: undefined, from: null, operation: '' }).toString()).toBe('')
  })
})

describe('serializeParam', () => {
  it('sin valor -> null; texto y números -> texto', () => {
    expect(serializeParam(null)).toBeNull()
    expect(serializeParam(undefined)).toBeNull()
    expect(serializeParam('')).toBeNull()
    expect(serializeParam('Error')).toBe('Error')
    expect(serializeParam(5)).toBe('5')
    expect(serializeParam(0)).toBe('0')
  })
})

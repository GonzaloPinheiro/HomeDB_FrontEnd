import { describe, expect, it } from 'vitest'

import { addRange, itemKey, toggleKey } from './selection'

describe('itemKey', () => {
  it('distingue un archivo y una carpeta con el mismo id', () => {
    expect(itemKey({ kind: 'file', id: 3 })).not.toBe(itemKey({ kind: 'folder', id: 3 }))
  })
})

describe('toggleKey', () => {
  it('añade y quita sin mutar el conjunto original', () => {
    const empty = new Set<string>()
    const one = toggleKey(empty, 'a')
    expect([...one]).toEqual(['a'])
    expect(empty.size).toBe(0)
    expect(toggleKey(one, 'a').size).toBe(0)
  })
})

describe('addRange', () => {
  const ordered = ['a', 'b', 'c', 'd', 'e']

  it('añade el tramo entre el ancla y el destino, en ambos sentidos', () => {
    expect([...addRange(new Set(['b']), ordered, 'b', 'd')].sort()).toEqual(['b', 'c', 'd'])
    expect([...addRange(new Set(['d']), ordered, 'd', 'b')].sort()).toEqual(['b', 'c', 'd'])
  })

  it('suma a lo ya seleccionado sin reemplazarlo', () => {
    expect([...addRange(new Set(['a', 'd']), ordered, 'd', 'e')].sort()).toEqual(['a', 'd', 'e'])
  })

  it('sin ancla, o con un ancla que ya no está en la lista, solo añade el destino', () => {
    expect([...addRange(new Set(), ordered, null, 'c')]).toEqual(['c'])
    expect([...addRange(new Set(), ordered, 'zzz', 'c')]).toEqual(['c'])
  })

  it('un destino fuera de la lista se añade tal cual (no rompe)', () => {
    expect([...addRange(new Set(), ordered, 'a', 'zzz')]).toEqual(['zzz'])
  })
})

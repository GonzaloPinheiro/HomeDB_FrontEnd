import { describe, expect, it } from 'vitest'

import { splitSearchTerm } from './search'

describe('splitSearchTerm (búsqueda combinada §6.6)', () => {
  it('con "@" se envía como email', () => {
    expect(splitSearchTerm('ana@example.com')).toEqual({ email: 'ana@example.com' })
    expect(splitSearchTerm('  @parcial ')).toEqual({ email: '@parcial' })
  })

  it('sin "@" se envía como userName', () => {
    expect(splitSearchTerm('ana')).toEqual({ userName: 'ana' })
    expect(splitSearchTerm('  ana  ')).toEqual({ userName: 'ana' })
  })

  it('vacío o solo espacios no envía ninguno de los dos', () => {
    expect(splitSearchTerm('')).toEqual({})
    expect(splitSearchTerm('   ')).toEqual({})
  })
})

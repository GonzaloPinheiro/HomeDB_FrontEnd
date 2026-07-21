import { describe, expect, it } from 'vitest'

import { decodeJwtClaims } from './jwt'

const ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'

function base64Url(value: object): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function buildToken(payload: object): string {
  return `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url(payload)}.firma-falsa`
}

describe('decodeJwtClaims', () => {
  it('extrae userId, username y rol con el URI largo de ClaimTypes.Role (forma real del backend)', () => {
    const token = buildToken({ userId: '7', username: 'ana', [ROLE_CLAIM]: 'Admin' })
    expect(decodeJwtClaims(token)).toEqual({ userId: 7, username: 'ana', role: 'Admin' })
  })

  it('acepta también el claim corto "role" como fallback', () => {
    const token = buildToken({ userId: '2', username: 'luis', role: 'User' })
    expect(decodeJwtClaims(token)).toEqual({ userId: 2, username: 'luis', role: 'User' })
  })

  it('devuelve null para un token malformado', () => {
    expect(decodeJwtClaims('no-es-un-jwt')).toBeNull()
    expect(decodeJwtClaims('a.b')).toBeNull()
    expect(decodeJwtClaims(`${base64Url({})}.@@@.x`)).toBeNull()
  })

  it('devuelve null si faltan claims obligatorios', () => {
    const token = buildToken({ username: 'sin-id', [ROLE_CLAIM]: 'User' })
    expect(decodeJwtClaims(token)).toBeNull()
  })
})

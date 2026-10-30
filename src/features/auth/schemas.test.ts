import { describe, expect, it } from 'vitest'

import { loginSchema, recoverPasswordSchema } from './schemas'

function firstMessage(result: {
  success: boolean
  error?: { issues: Array<{ message: string }> }
}): string | undefined {
  return result.error?.issues[0]?.message
}

describe('loginSchema', () => {
  it('pide usuario y contraseña', () => {
    expect(firstMessage(loginSchema.safeParse({ username: '', password: 'x' }))).toBe(
      'Escribe tu nombre de usuario',
    )
    expect(firstMessage(loginSchema.safeParse({ username: 'ana', password: '' }))).toBe(
      'Escribe tu contraseña',
    )
    expect(loginSchema.safeParse({ username: 'ana', password: 'x' }).success).toBe(true)
  })
})

describe('recoverPasswordSchema', () => {
  it('acepta un correo válido y le quita los espacios de alrededor', () => {
    const result = recoverPasswordSchema.safeParse({ email: '  ana@ejemplo.com ' })
    expect(result.success).toBe(true)
    expect(result.data?.email).toBe('ana@ejemplo.com')
  })

  it('distingue vacío de mal formado', () => {
    expect(firstMessage(recoverPasswordSchema.safeParse({ email: '' }))).toBe(
      'Escribe tu correo electrónico',
    )
    expect(firstMessage(recoverPasswordSchema.safeParse({ email: '   ' }))).toBe(
      'Escribe tu correo electrónico',
    )
    expect(firstMessage(recoverPasswordSchema.safeParse({ email: 'ana' }))).toBe(
      'Escribe un correo válido',
    )
    expect(firstMessage(recoverPasswordSchema.safeParse({ email: 'ana@' }))).toBe(
      'Escribe un correo válido',
    )
    expect(firstMessage(recoverPasswordSchema.safeParse({ email: 'ana@ejemplo' }))).toBe(
      'Escribe un correo válido',
    )
  })
})

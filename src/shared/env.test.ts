import { describe, expect, it } from 'vitest'

import { envSchema } from './env'

describe('envSchema (CLAUDE.md §7.7)', () => {
  it('acepta una URL válida', () => {
    expect(envSchema.safeParse({ VITE_API_URL: 'http://localhost:5173' }).success).toBe(true)
  })

  it('rechaza un valor que no es URL', () => {
    expect(envSchema.safeParse({ VITE_API_URL: 'no-es-una-url' }).success).toBe(false)
  })

  it('rechaza la ausencia de VITE_API_URL', () => {
    expect(envSchema.safeParse({}).success).toBe(false)
  })
})

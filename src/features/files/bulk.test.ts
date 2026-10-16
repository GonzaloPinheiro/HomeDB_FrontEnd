import { describe, expect, it } from 'vitest'

import { describeBulkOutcome, runBulk, type BulkResult } from './bulk'

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('runBulk', () => {
  it('intenta todos los elementos aunque alguno falle y los separa', async () => {
    const result = await runBulk([1, 2, 3, 4], async (n) => {
      if (n === 2) throw new Error('boom')
    })
    expect(result.succeeded.sort()).toEqual([1, 3, 4])
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].item).toBe(2)
  })

  it('nunca lanza, ni siquiera si fallan todos', async () => {
    const result = await runBulk([1, 2], async () => {
      throw new Error('x')
    })
    expect(result.succeeded).toEqual([])
    expect(result.failed).toHaveLength(2)
  })

  it('no supera la concurrencia pedida', async () => {
    let inFlight = 0
    let maxInFlight = 0
    await runBulk(
      Array.from({ length: 10 }, (_, i) => i),
      async () => {
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        await tick()
        inFlight -= 1
      },
      3,
    )
    expect(maxInFlight).toBe(3)
  })

  it('con una lista vacía devuelve vacío sin ejecutar nada', async () => {
    const result = await runBulk([], async () => {
      throw new Error('no debería ejecutarse')
    })
    expect(result).toEqual({ succeeded: [], failed: [] })
  })
})

describe('describeBulkOutcome', () => {
  type Item = { name: string }
  const labels = { done: (n: number) => `${n} eliminados`, verb: 'eliminar' }
  const messageOf = (error: unknown) => (error as Error).message
  const fail = (name: string, message: string) => ({ item: { name }, error: new Error(message) })

  it('éxito total: solo el recuento', () => {
    const result: BulkResult<Item> = { succeeded: [{ name: 'a' }, { name: 'b' }], failed: [] }
    expect(describeBulkOutcome(result, labels, messageOf)).toEqual({ ok: true, message: '2 eliminados' })
  })

  it('un único fallo total nombra el elemento y la causa', () => {
    const result: BulkResult<Item> = { succeeded: [], failed: [fail('docs', 'La carpeta tiene contenido')] }
    expect(describeBulkOutcome(result, labels, messageOf)).toEqual({
      ok: false,
      message: 'No se pudo eliminar "docs": La carpeta tiene contenido',
    })
  })

  it('todos fallan: cuenta y nombra el primero', () => {
    const result: BulkResult<Item> = { succeeded: [], failed: [fail('a', 'X'), fail('b', 'X'), fail('c', 'X')] }
    expect(describeBulkOutcome(result, labels, messageOf).message).toBe(
      'No se pudieron eliminar 3 elementos — "a": X (y 2 más)',
    )
  })

  it('fallo parcial: informa de lo que sí salió y de lo que no', () => {
    const result: BulkResult<Item> = { succeeded: [{ name: 'a' }, { name: 'b' }], failed: [fail('c', 'X')] }
    const outcome = describeBulkOutcome(result, labels, messageOf)
    expect(outcome.ok).toBe(false)
    expect(outcome.message).toBe('2 eliminados, pero 1 no se pudo eliminar — "c": X')
  })

  it('fallo parcial con varios fallos usa el plural', () => {
    const result: BulkResult<Item> = { succeeded: [{ name: 'a' }], failed: [fail('b', 'X'), fail('c', 'X')] }
    expect(describeBulkOutcome(result, labels, messageOf).message).toBe(
      '1 eliminados, pero 2 no se pudieron eliminar — "b": X (y 1 más)',
    )
  })
})

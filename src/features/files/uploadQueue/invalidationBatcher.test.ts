import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { InvalidationBatcher, type InvalidationBatch } from './invalidationBatcher'

const INTERVAL = 2_000

let batches: InvalidationBatch[]
let batcher: InvalidationBatcher

beforeEach(() => {
  vi.useFakeTimers()
  batches = []
  batcher = new InvalidationBatcher((batch) => batches.push(batch), INTERVAL)
})

afterEach(() => {
  batcher.dispose()
  vi.useRealTimers()
})

describe('InvalidationBatcher', () => {
  it('la primera marca sale al instante: un archivo suelto se ve igual de rápido que antes', () => {
    batcher.markChanged(5, { storageUsage: true })
    expect(batches).toEqual([{ folderIds: [5], storageUsage: true }])
  })

  it('carpeta y almacenamiento de un mismo archivo salen en la MISMA tanda', () => {
    // Regresión de diseño: con dos llamadas separadas, la segunda esperaba a que se cerrase la ventana.
    batcher.markChanged(5, { storageUsage: true })
    expect(batches).toHaveLength(1)
    expect(batches[0].storageUsage).toBe(true)
  })

  it('una marca sin storageUsage no pide refrescar el almacenamiento (carpeta nueva)', () => {
    batcher.markChanged(5)
    expect(batches).toEqual([{ folderIds: [5], storageUsage: false }])
  })

  it('lo que llega dentro de la ventana se junta y sale una sola vez al cerrarse', () => {
    batcher.markChanged(1, { storageUsage: true })
    for (let i = 0; i < 100; i++) batcher.markChanged(1, { storageUsage: true })
    batcher.markChanged(2)
    expect(batches).toHaveLength(1)

    vi.advanceTimersByTime(INTERVAL - 1)
    expect(batches).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(batches).toHaveLength(2)
    expect(batches[1]).toEqual({ folderIds: [1, 2], storageUsage: true })
  })

  it('la raíz (null) y las carpetas se distinguen y no se repiten', () => {
    batcher.markChanged(null) // tanda inicial (la raíz)
    batcher.markChanged(null)
    batcher.markChanged(7)
    batcher.markChanged(7)
    batcher.markChanged(null)
    vi.advanceTimersByTime(INTERVAL)
    expect(batches[0].folderIds).toEqual([null])
    expect(batches[1].folderIds).toEqual([null, 7])
  })

  it('dos tandas nunca quedan a menos de `intervalMs` mientras no paran de llegar marcas', () => {
    const times: number[] = []
    batcher.dispose()
    // Date.now() es el reloj simulado: avanza con los temporizadores, así se mide el instante REAL de cada tanda
    batcher = new InvalidationBatcher(() => times.push(Date.now()), INTERVAL)

    // Una marca cada 100 ms durante 10 s
    for (let elapsed = 0; elapsed < 10_000; elapsed += 100) {
      batcher.markChanged(1)
      vi.advanceTimersByTime(100)
    }
    expect(times.length).toBeGreaterThan(1)
    for (let i = 1; i < times.length; i++) {
      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(INTERVAL)
    }
    // 100 marcas por segundo durante 10 s: unas 6 tandas, no 100
    expect(times.length).toBeLessThanOrEqual(6)
  })

  it('tras un rato en calma, la siguiente marca vuelve a salir al instante', () => {
    batcher.markChanged(1)
    vi.advanceTimersByTime(INTERVAL) // la ventana se cierra sin nada pendiente
    expect(batches).toHaveLength(1)

    batcher.markChanged(1)
    expect(batches).toHaveLength(2)
  })

  it('flushNow vacía lo pendiente sin esperar a que cierre la ventana', () => {
    batcher.markChanged(1, { storageUsage: true })
    batcher.markChanged(2, { storageUsage: true })
    expect(batches).toHaveLength(1)

    batcher.flushNow()
    expect(batches).toHaveLength(2)
    expect(batches[1]).toEqual({ folderIds: [2], storageUsage: true })

    // y no se duplica cuando la ventana se cierra después
    vi.advanceTimersByTime(INTERVAL * 3)
    expect(batches).toHaveLength(2)
  })

  it('flushNow sin nada pendiente no hace nada', () => {
    batcher.flushNow()
    batcher.markChanged(1)
    batcher.flushNow()
    batcher.flushNow()
    expect(batches).toHaveLength(1)
  })

  it('dispose descarta lo pendiente y cancela la ventana, pero el objeto sigue sirviendo', () => {
    batcher.markChanged(1)
    batcher.markChanged(2)
    batcher.dispose()
    vi.advanceTimersByTime(INTERVAL * 3)
    expect(batches).toHaveLength(1) // solo la tanda inicial; lo pendiente se descartó

    // Un montaje posterior (StrictMode desmonta y vuelve a montar) debe seguir funcionando
    batcher.markChanged(3)
    expect(batches).toHaveLength(2)
    expect(batches[1].folderIds).toEqual([3])
  })
})

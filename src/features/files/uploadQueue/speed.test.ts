import { describe, expect, it } from 'vitest'

import { SPEED_WINDOW_MS, SpeedTracker, estimateRemainingMs } from './speed'

const MB = 1024 * 1024

describe('SpeedTracker', () => {
  it('null sin muestras o con muy poco tiempo de muestra', () => {
    const tracker = new SpeedTracker()
    expect(tracker.bytesPerSecond(0)).toBeNull()
    tracker.record(0, 0)
    expect(tracker.bytesPerSecond(500)).toBeNull()
  })

  it('calcula bytes por segundo con ritmo constante', () => {
    const tracker = new SpeedTracker()
    tracker.record(0, 0)
    tracker.record(1000, 10 * MB)
    tracker.record(2000, 20 * MB)
    expect(tracker.bytesPerSecond(2000)).toBeCloseTo(10 * MB)
  })

  it('solo mira la ventana reciente: un arranque lento no arrastra la media', () => {
    const tracker = new SpeedTracker()
    tracker.record(0, 0)
    tracker.record(5_000, 1 * MB) // 0,2 MB/s al principio
    // luego 50 MB/s sostenidos durante más que la ventana
    for (let t = 1; t <= 20; t++) tracker.record(5_000 + t * 1000, 1 * MB + t * 50 * MB)
    expect(tracker.bytesPerSecond(25_000)).toBeCloseTo(50 * MB, -4)
  })

  it('cae sola si la subida se atasca, en vez de congelarse en el último valor', () => {
    const tracker = new SpeedTracker()
    tracker.record(0, 0)
    tracker.record(2000, 20 * MB)
    const running = tracker.bytesPerSecond(2000)!
    const stalled = tracker.bytesPerSecond(8000)!
    expect(stalled).toBeLessThan(running / 2)
    expect(tracker.bytesPerSecond(2000 + SPEED_WINDOW_MS + 1)).toBeNull() // ya sin muestras en ventana
  })

  it('un reintento (el total retrocede) no hunde la velocidad: los bytes enviados cuentan', () => {
    const tracker = new SpeedTracker()
    tracker.record(0, 0)
    tracker.record(1000, 30 * MB)
    tracker.record(2000, 20 * MB) // un chunk de 10 MB falló y vuelve a 0
    tracker.record(3000, 50 * MB)
    // transmitido = 30 + 0 + 30 = 60 MB en 3 s
    expect(tracker.bytesPerSecond(3000)).toBeCloseTo(20 * MB)
  })

  it('no devuelve velocidad negativa', () => {
    const tracker = new SpeedTracker()
    tracker.record(0, 10 * MB)
    tracker.record(2000, 0)
    expect(tracker.bytesPerSecond(2000)).toBeGreaterThanOrEqual(0)
  })
})

describe('estimateRemainingMs', () => {
  it('bytes restantes entre velocidad', () => {
    expect(estimateRemainingMs(100 * MB, 10 * MB)).toBe(10_000)
  })

  it('null sin velocidad, parada o con datos inválidos', () => {
    expect(estimateRemainingMs(100, null)).toBeNull()
    expect(estimateRemainingMs(100, 0)).toBeNull()
    expect(estimateRemainingMs(-1, 10)).toBeNull()
  })

  it('0 si no queda nada', () => {
    expect(estimateRemainingMs(0, 5 * MB)).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'

import {
  barPercent,
  criticalDrillDown,
  criticalMeta,
  criticalTotal,
  DEFAULT_ERROR_SUMMARY_RANGE,
  DEFAULT_SLOW_THRESHOLD,
  ERROR_SUMMARY_LIMIT,
  ERROR_SUMMARY_RANGE_IDS,
  ERROR_SUMMARY_RANGES,
  healthTone,
  SLOW_OPERATIONS_LIMIT,
  SLOW_PREVIEW_COUNT,
  SLOW_THRESHOLD_IDS,
  SLOW_THRESHOLDS,
  slowDrillDown,
  slowMeta,
  utcDay,
} from './presentation'
import type { ErrorSummaryItem } from './types'

function items(...counts: number[]): ErrorSummaryItem[] {
  return counts.map((count, index) => ({ operation: `Op${index}`, count }))
}

describe('rangos y umbrales', () => {
  it('los valores por defecto coinciden con los del endpoint (24 h, 2000 ms)', () => {
    expect(ERROR_SUMMARY_RANGES[DEFAULT_ERROR_SUMMARY_RANGE].hours).toBe(24)
    expect(SLOW_THRESHOLDS[DEFAULT_SLOW_THRESHOLD].thresholdMs).toBe(2000)
  })

  it('cada rango tiene horas positivas y enteras (el backend no las valida)', () => {
    for (const id of ERROR_SUMMARY_RANGE_IDS) {
      const { hours } = ERROR_SUMMARY_RANGES[id]
      expect(Number.isInteger(hours)).toBe(true)
      expect(hours).toBeGreaterThan(0)
    }
  })

  it('los rangos y umbrales están ordenados de menor a mayor', () => {
    const hours = ERROR_SUMMARY_RANGE_IDS.map((id) => ERROR_SUMMARY_RANGES[id].hours)
    const thresholds = SLOW_THRESHOLD_IDS.map((id) => SLOW_THRESHOLDS[id].thresholdMs)
    expect(hours).toEqual([...hours].sort((a, b) => a - b))
    expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b))
  })

  it('la vista previa de lentas es menor que el tope del backend', () => {
    expect(SLOW_PREVIEW_COUNT).toBeLessThan(SLOW_OPERATIONS_LIMIT)
  })
})

describe('healthTone', () => {
  it('cero es siempre ok, sea error o aviso', () => {
    expect(healthTone('error', 0)).toBe('ok')
    expect(healthTone('warning', 0)).toBe('ok')
  })

  it('un error es crítico y un aviso solo advierte', () => {
    expect(healthTone('error', 1)).toBe('critical')
    expect(healthTone('warning', 3)).toBe('warning')
  })

  it('un contador negativo (no debería llegar) se trata como cero', () => {
    expect(healthTone('error', -2)).toBe('ok')
  })
})

describe('criticalTotal / criticalMeta', () => {
  it('suma los recuentos', () => {
    expect(criticalTotal(items(5, 2, 1)).total).toBe(8)
  })

  it('con menos de 10 operaciones el total es exacto', () => {
    expect(criticalTotal(items(5, 2)).isLowerBound).toBe(false)
    expect(criticalMeta(items(5, 2), '24 h')).toBe('7 en 24 h')
  })

  it('con el tope de operaciones el total es solo una cota inferior', () => {
    const full = items(...Array.from({ length: ERROR_SUMMARY_LIMIT }, () => 1))
    expect(criticalTotal(full).isLowerBound).toBe(true)
    expect(criticalMeta(full, '7 d')).toBe('≥ 10 en 7 d')
  })

  it('sin datos -> 0', () => {
    expect(criticalMeta([], '24 h')).toBe('0 en 24 h')
  })
})

describe('slowMeta', () => {
  it('concuerda el verbo en singular y plural', () => {
    expect(slowMeta(1, '2 s')).toBe('1 supera 2 s')
    expect(slowMeta(3, '2 s')).toBe('3 superan 2 s')
    expect(slowMeta(0, '500 ms')).toBe('0 superan 500 ms')
  })

  it('con el tope del backend indica que puede haber más', () => {
    expect(slowMeta(SLOW_OPERATIONS_LIMIT, '1 s')).toBe('50+ superan 1 s')
  })
})

describe('barPercent', () => {
  it('es proporcional al máximo de la lista', () => {
    expect(barPercent(5, 10)).toBe(50)
    expect(barPercent(10, 10)).toBe(100)
  })

  it('máximo cero o negativo -> 0 (sin dividir por cero)', () => {
    expect(barPercent(5, 0)).toBe(0)
    expect(barPercent(5, -1)).toBe(0)
  })

  it('acota a 0-100', () => {
    expect(barPercent(20, 10)).toBe(100)
    expect(barPercent(-1, 10)).toBe(0)
  })
})

describe('utcDay', () => {
  it('devuelve el día UTC, no el local', () => {
    expect(utcDay('2026-11-02T23:59:59Z')).toBe('2026-11-02')
    expect(utcDay('2026-11-02T00:00:00Z')).toBe('2026-11-02')
  })

  it('normaliza un offset al día UTC', () => {
    // 01:30 en +02:00 es 23:30 del día anterior en UTC
    expect(utcDay('2026-11-02T01:30:00+02:00')).toBe('2026-11-01')
  })

  it('fecha inválida -> null', () => {
    expect(utcDay('no-es-una-fecha')).toBeNull()
  })
})

describe('drill-down', () => {
  it('una excepción crítica filtra por nivel Critical y operación, sin fechas', () => {
    expect(criticalDrillDown({ operation: 'UploadChunkAsync()', count: 4 })).toEqual({
      level: 'Critical',
      operation: 'UploadChunkAsync()',
    })
  })

  it('una operación lenta filtra por su operación y el día UTC en que ocurrió', () => {
    expect(
      slowDrillDown({ operation: 'GetFilesAsync()', durationMs: 4100, timeStamp: '2026-10-30T18:02:11Z' }),
    ).toEqual({ operation: 'GetFilesAsync()', from: '2026-10-30', to: '2026-10-30' })
  })

  it('con un timestamp inválido filtra solo por operación (sin fechas rotas)', () => {
    expect(slowDrillDown({ operation: 'X', durationMs: 3000, timeStamp: 'roto' })).toEqual({ operation: 'X' })
  })
})

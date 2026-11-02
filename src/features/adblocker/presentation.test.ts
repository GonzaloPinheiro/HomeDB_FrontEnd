import { describe, expect, it } from 'vitest'

import {
  STALE_LIST_HOURS,
  clampPercent,
  computeBlockedPercent,
  describeListsSummary,
  formatClock,
  formatCountdown,
  formatListAge,
  formatPercent,
  getListAgeHours,
  getPanelHost,
  getProtectionMode,
  isListStale,
  msUntil,
  oneInEvery,
  parsePauseMinutes,
  parseThresholdPercent,
  queriesPerHour,
  summarizeLists,
} from './presentation'
import type { FilterListStatus } from './types'

const NOW = Date.parse('2026-11-01T12:00:00Z')
const HOUR = 3_600_000

describe('getProtectionMode', () => {
  it('protegido si la protección está activa, tenga o no un pausedUntil residual', () => {
    expect(getProtectionMode({ protectionEnabled: true, pausedUntil: null }, NOW)).toBe('protected')
    expect(getProtectionMode({ protectionEnabled: true, pausedUntil: '2026-11-01T13:00:00Z' }, NOW)).toBe('protected')
  })

  it('pausado mientras pausedUntil esté en el futuro', () => {
    expect(getProtectionMode({ protectionEnabled: false, pausedUntil: '2026-11-01T12:30:00Z' }, NOW)).toBe('paused')
  })

  it('una pausa ya vencida cuenta como desactivada, no como pausada con 0:00', () => {
    expect(getProtectionMode({ protectionEnabled: false, pausedUntil: '2026-11-01T11:59:59Z' }, NOW)).toBe('disabled')
    expect(getProtectionMode({ protectionEnabled: false, pausedUntil: '2026-11-01T12:00:00Z' }, NOW)).toBe('disabled')
  })

  it('desactivado hasta reactivar si no hay pausedUntil', () => {
    expect(getProtectionMode({ protectionEnabled: false, pausedUntil: null }, NOW)).toBe('disabled')
  })
})

describe('msUntil / formatCountdown / formatClock', () => {
  it('msUntil nunca es negativo y tolera fechas inválidas', () => {
    expect(msUntil('2026-11-01T12:00:30Z', NOW)).toBe(30_000)
    expect(msUntil('2026-11-01T11:00:00Z', NOW)).toBe(0)
    expect(msUntil('no-es-una-fecha', NOW)).toBe(0)
  })

  it('formatCountdown: m:ss por debajo de una hora y h:mm:ss a partir de ella', () => {
    expect(formatCountdown(0)).toBe('0:00')
    expect(formatCountdown(47_000)).toBe('0:47')
    expect(formatCountdown(29 * 60_000 + 13_000)).toBe('29:13')
    expect(formatCountdown(3_600_000)).toBe('1:00:00')
    expect(formatCountdown(8 * HOUR - 1000)).toBe('7:59:59')
  })

  it('formatCountdown redondea hacia arriba: no enseña 0:00 con tiempo todavía por delante', () => {
    expect(formatCountdown(1)).toBe('0:01')
    expect(formatCountdown(-500)).toBe('0:00')
  })

  it('formatClock da la hora local con cero a la izquierda', () => {
    expect(formatClock(new Date(2026, 10, 1, 9, 5).toISOString())).toBe('09:05')
    expect(formatClock('no-es-una-fecha')).toBe('—')
  })
})

describe('cifras del resumen', () => {
  it('computeBlockedPercent no divide entre cero', () => {
    expect(computeBlockedPercent(0, 0)).toBe(0)
    expect(computeBlockedPercent(200, 50)).toBe(25)
  })

  it('formatPercent usa coma decimal', () => {
    expect(formatPercent(25.2)).toBe('25,2 %')
    expect(formatPercent(0)).toBe('0,0 %')
  })

  it('queriesPerHour es la media sobre 24 h', () => {
    expect(queriesPerHour(2400)).toBe(100)
  })

  it('oneInEvery da "1 de cada N" y null si no se bloquea nada', () => {
    expect(oneInEvery(25)).toBe(4)
    expect(oneInEvery(100)).toBe(1)
    expect(oneInEvery(0)).toBeNull()
    // Nunca 0: un 150 % (dato roto) no puede dar "1 de cada 0"
    expect(oneInEvery(150)).toBe(1)
  })

  it('clampPercent acota a 0-100', () => {
    expect(clampPercent(-3)).toBe(0)
    expect(clampPercent(42)).toBe(42)
    expect(clampPercent(130)).toBe(100)
  })
})

describe('listas de bloqueo', () => {
  const ago = (hours: number): string => new Date(NOW - hours * HOUR).toISOString()
  const list = (hoursAgo: number, enabled = true): FilterListStatus => ({
    name: 'Lista',
    ruleCount: 1,
    enabled,
    lastUpdated: ago(hoursAgo),
  })

  it('una lista está desactualizada solo al pasar de 7 días', () => {
    expect(isListStale(list(STALE_LIST_HOURS), NOW)).toBe(false)
    expect(isListStale(list(STALE_LIST_HOURS + 1), NOW)).toBe(true)
    expect(isListStale(list(3), NOW)).toBe(false)
  })

  it('getListAgeHours tolera fechas futuras o inválidas', () => {
    expect(getListAgeHours(ago(-5), NOW)).toBe(0)
    expect(getListAgeHours('no-es-una-fecha', NOW)).toBe(0)
  })

  it('formatListAge', () => {
    expect(formatListAge(0.2)).toBe('hace unos minutos')
    expect(formatListAge(5.9)).toBe('hace 5 h')
    expect(formatListAge(26)).toBe('ayer')
    expect(formatListAge(12 * 24)).toBe('hace 12 días')
  })

  it('summarizeLists y describeListsSummary', () => {
    const lists = [list(3), list(50), list(12 * 24), list(38 * 24, false)]
    const summary = summarizeLists(lists, NOW)
    expect(summary).toEqual({ active: 3, total: 4, stale: 2 })
    expect(describeListsSummary(summary)).toBe('3 de 4 activas · 2 sin actualizar')
    expect(describeListsSummary({ active: 2, total: 2, stale: 0 })).toBe('2 de 2 activas')
  })
})

describe('getPanelHost', () => {
  it('extrae host y puerto, o null si no hay URL válida', () => {
    expect(getPanelHost('http://192.168.1.2:3000')).toBe('192.168.1.2:3000')
    expect(getPanelHost('https://adguard.local/panel')).toBe('adguard.local')
    expect(getPanelHost(null)).toBeNull()
    expect(getPanelHost('esto no es una url')).toBeNull()
  })
})

describe('validación de números', () => {
  it('parsePauseMinutes: entero de 1 a 1440', () => {
    expect(parsePauseMinutes('45')).toEqual({ ok: true, value: 45 })
    expect(parsePauseMinutes('1')).toEqual({ ok: true, value: 1 })
    expect(parsePauseMinutes('1440')).toEqual({ ok: true, value: 1440 })
    for (const invalid of ['', '  ', '0', '-5', '1441', '2,5', '1.5', 'abc']) {
      expect(parsePauseMinutes(invalid).ok, `"${invalid}"`).toBe(false)
    }
  })

  it('parseThresholdPercent: entero de 0 a 100', () => {
    expect(parseThresholdPercent('0')).toEqual({ ok: true, value: 0 })
    expect(parseThresholdPercent('15')).toEqual({ ok: true, value: 15 })
    expect(parseThresholdPercent('100')).toEqual({ ok: true, value: 100 })
    for (const invalid of ['', '101', '-1', '15.5', '1e2', 'abc', '1000']) {
      expect(parseThresholdPercent(invalid).ok, `"${invalid}"`).toBe(false)
    }
  })
})

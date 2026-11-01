import { describe, expect, it } from 'vitest'

import {
  countBlocked,
  countPending,
  describePending,
  filterServices,
  getServiceInitial,
  isServiceBlocked,
  togglePending,
} from './services'
import type { BlockedService } from './types'

const TIKTOK: BlockedService = { id: 'tiktok', name: 'TikTok', blocked: true }
const NETFLIX: BlockedService = { id: 'netflix', name: 'Netflix', blocked: false }
const TWITCH: BlockedService = { id: 'twitch', name: 'Twitch', blocked: false }
const ALL = [TIKTOK, NETFLIX, TWITCH]

describe('cambios pendientes', () => {
  it('sin pendientes, el estado efectivo es el guardado', () => {
    expect(isServiceBlocked(TIKTOK, {})).toBe(true)
    expect(isServiceBlocked(NETFLIX, {})).toBe(false)
  })

  it('togglePending anota el cambio y no muta la entrada', () => {
    const before = {}
    const after = togglePending(before, NETFLIX)
    expect(after).toEqual({ netflix: true })
    expect(before).toEqual({})
    expect(isServiceBlocked(NETFLIX, after)).toBe(true)
  })

  it('volver al valor guardado deja de ser un cambio', () => {
    const once = togglePending({}, TIKTOK)
    expect(once).toEqual({ tiktok: false })
    expect(togglePending(once, TIKTOK)).toEqual({})
  })

  it('cuenta pendientes y bloqueados efectivos', () => {
    const pending = togglePending(togglePending({}, NETFLIX), TIKTOK)
    expect(countPending(pending)).toBe(2)
    // TikTok pasa a desbloqueado, Netflix a bloqueado: sigue habiendo 1
    expect(countBlocked(ALL, pending)).toBe(1)
    expect(countBlocked(ALL, {})).toBe(1)
  })

  it('describePending concuerda en singular y plural', () => {
    expect(describePending(1)).toBe('1 cambio sin guardar')
    expect(describePending(3)).toBe('3 cambios sin guardar')
  })
})

describe('filterServices', () => {
  it('filtra por nombre sin distinguir mayúsculas ni espacios de los bordes', () => {
    expect(filterServices(ALL, {}, '  NET ', false)).toEqual([NETFLIX])
    expect(filterServices(ALL, {}, '', false)).toEqual(ALL)
    expect(filterServices(ALL, {}, 'zzz', false)).toEqual([])
  })

  it('"solo bloqueados" usa el estado efectivo', () => {
    expect(filterServices(ALL, {}, '', true)).toEqual([TIKTOK])
    expect(filterServices(ALL, togglePending({}, NETFLIX), '', true)).toEqual([TIKTOK, NETFLIX])
  })

  it('un servicio recién desbloqueado no desaparece de "solo bloqueados" hasta guardar o descartar', () => {
    const pending = togglePending({}, TIKTOK)
    expect(isServiceBlocked(TIKTOK, pending)).toBe(false)
    expect(filterServices(ALL, pending, '', true)).toEqual([TIKTOK])
  })
})

describe('getServiceInitial', () => {
  it('primera letra o cifra, en mayúscula', () => {
    expect(getServiceInitial('9GAG')).toBe('9')
    expect(getServiceInitial('eBay')).toBe('E')
    expect(getServiceInitial('(X) Twitter')).toBe('X')
    expect(getServiceInitial('★★')).toBe('?')
  })
})

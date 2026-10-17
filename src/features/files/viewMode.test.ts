import { afterEach, describe, expect, it, vi } from 'vitest'

import { parseViewMode, readStoredViewMode, storeViewMode, VIEW_MODE_KEY } from './viewMode'

describe('viewMode', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('solo "grid" es la vista de miniaturas; cualquier otra cosa es la lista', () => {
    expect(parseViewMode('grid')).toBe('grid')
    expect(parseViewMode('list')).toBe('list')
    for (const value of [null, undefined, '', 'Grid', 'tiles', 3, {}]) {
      expect(parseViewMode(value)).toBe('list')
    }
  })

  it('guarda y recupera el modo en localStorage', () => {
    expect(readStoredViewMode()).toBe('list')
    storeViewMode('grid')
    expect(localStorage.getItem(VIEW_MODE_KEY)).toBe('grid')
    expect(readStoredViewMode()).toBe('grid')
    storeViewMode('list')
    expect(readStoredViewMode()).toBe('list')
  })

  it('con un valor corrupto guardado vuelve a la lista', () => {
    localStorage.setItem(VIEW_MODE_KEY, '{"mode":"grid"}')
    expect(readStoredViewMode()).toBe('list')
  })

  it('si localStorage lanza (datos de sitio bloqueados) no rompe: lee la lista y escribir no hace nada', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(readStoredViewMode()).toBe('list')
    expect(() => storeViewMode('grid')).not.toThrow()
  })
})

import { act, cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLogsFilters } from './useLogsFilters'

type Probe = {
  logs: ReturnType<typeof useLogsFilters>
  location: ReturnType<typeof useLocation>
  navigationType: ReturnType<typeof useNavigationType>
}

/** Monta el hook dentro de un router en memoria y expone su valor junto a la ubicación actual. */
function setup(initialEntry: string) {
  const probe = {} as Probe
  function Harness(): ReactNode {
    probe.logs = useLogsFilters()
    probe.location = useLocation()
    probe.navigationType = useNavigationType()
    return null
  }
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Harness />
    </MemoryRouter>,
  )
  return probe
}

const query = (probe: Probe) => new URLSearchParams(probe.location.search)

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useLogsFilters', () => {
  it('lee los filtros y la página de la URL (enlace compartido o refresco)', () => {
    const probe = setup('/admin/logs?level=Error&operation=Upload&page=3')
    expect(probe.logs.filters.level).toBe('Error')
    expect(probe.logs.filters.operation).toBe('Upload')
    expect(probe.logs.page).toBe(3)
    expect(probe.logs.activeFilterCount).toBe(2)
    expect(probe.logs.operationField.value).toBe('Upload')
  })

  it('setFilter cambia solo ese filtro y vuelve a la primera página', () => {
    const probe = setup('/admin/logs?level=Warning&page=4')
    act(() => probe.logs.setFilter({ from: '2026-10-01' }))
    expect(query(probe).get('level')).toBe('Warning')
    expect(query(probe).get('from')).toBe('2026-10-01')
    expect(query(probe).has('page')).toBe(false)
  })

  it('setPage escribe la página, y la primera no deja rastro en la URL', () => {
    const probe = setup('/admin/logs')
    act(() => probe.logs.setPage(2))
    expect(query(probe).get('page')).toBe('2')
    act(() => probe.logs.setPage(1))
    expect(query(probe).has('page')).toBe(false)
  })

  it('escribir en Operación vuelca a la URL solo tras el retardo, y vuelve a la primera página', () => {
    const probe = setup('/admin/logs?page=2')
    act(() => probe.logs.operationField.onChange('Get'))
    expect(probe.logs.operationField.value).toBe('Get')
    expect(query(probe).has('operation')).toBe(false)

    act(() => vi.advanceTimersByTime(300))
    expect(query(probe).get('operation')).toBe('Get')
    expect(query(probe).has('page')).toBe(false)
  })

  it('showOnly deja los filtros EXACTAMENTE como se piden y sincroniza el campo de texto', () => {
    const probe = setup('/admin/logs?level=Warning&correlationId=abc&page=5')
    act(() => probe.logs.showOnly({ level: 'Critical', operation: 'UploadChunkAsync()' }))

    expect(probe.logs.filters).toEqual({
      level: 'Critical',
      operation: 'UploadChunkAsync()',
      from: null,
      to: null,
      correlationId: null,
    })
    expect(probe.logs.page).toBe(1)
    expect(probe.logs.operationField.value).toBe('UploadChunkAsync()')
  })

  it('un drill-down NO es pisado por un texto a medio escribir (la carrera que evita useDebouncedField)', () => {
    const probe = setup('/admin/logs')
    act(() => probe.logs.operationField.onChange('Gx'))
    act(() => probe.logs.showOnly({ level: 'Critical', operation: 'UploadChunkAsync()' }))
    act(() => vi.advanceTimersByTime(1000))

    expect(query(probe).get('operation')).toBe('UploadChunkAsync()')
    expect(probe.logs.operationField.value).toBe('UploadChunkAsync()')
  })

  it('clearFilters limpia filtros, página y campo de texto, pero conserva ?settings= del modal', () => {
    const probe = setup('/admin/logs?settings=security&level=Error&operation=Up&page=2')
    act(() => probe.logs.clearFilters())

    expect(probe.logs.activeFilterCount).toBe(0)
    expect(probe.logs.operationField.value).toBe('')
    expect(query(probe).get('settings')).toBe('security')
    expect(query(probe).has('level')).toBe(false)
  })

  it('los cambios usan replace: no apilan entradas en el historial', () => {
    const probe = setup('/admin/logs')
    expect(probe.navigationType).toBe('POP')

    act(() => probe.logs.setFilter({ level: 'Error' }))
    expect(probe.navigationType).toBe('REPLACE')

    act(() => probe.logs.showOnly({ level: 'Critical' }))
    expect(probe.navigationType).toBe('REPLACE')
  })
})

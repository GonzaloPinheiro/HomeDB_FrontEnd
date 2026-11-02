import { act, cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuditFilters } from './useAuditFilters'

type Probe = {
  audit: ReturnType<typeof useAuditFilters>
  location: ReturnType<typeof useLocation>
}

/** Monta el hook dentro de un router en memoria y expone su valor junto a la ubicación actual. */
function setup(initialEntry: string) {
  const probe = {} as Probe
  function Harness(): ReactNode {
    probe.audit = useAuditFilters()
    probe.location = useLocation()
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

describe('useAuditFilters', () => {
  it('lee el userId de la URL como número (enlace desde la pantalla de Usuarios)', () => {
    const probe = setup('/admin/audit-logs?userId=5')
    expect(probe.audit.filters.userId).toBe(5)
    expect(probe.audit.activeFilterCount).toBe(1)
  })

  it('un userId numérico se escribe en la URL como texto y borrarlo lo quita', () => {
    const probe = setup('/admin/audit-logs')
    act(() => probe.audit.setFilter({ userId: 9 }))
    expect(query(probe).get('userId')).toBe('9')
    expect(probe.audit.filters.userId).toBe(9)

    act(() => probe.audit.setFilter({ userId: null }))
    expect(query(probe).has('userId')).toBe(false)
  })

  it('elegir un usuario exacto vacía la búsqueda por texto, también en el campo visible', () => {
    const probe = setup('/admin/audit-logs?userName=ana&page=3')
    expect(probe.audit.textField.value).toBe('ana')

    act(() => probe.audit.setFilter({ userId: 5, userName: '' }))

    expect(query(probe).get('userId')).toBe('5')
    expect(query(probe).has('userName')).toBe(false)
    expect(query(probe).has('page')).toBe(false)
    expect(probe.audit.textField.value).toBe('')
  })

  it('un cambio de filtro de fila SUMA a los existentes', () => {
    const probe = setup('/admin/audit-logs?action=LOGIN')
    act(() => probe.audit.setFilter({ userId: 5, userName: '' }))
    expect(query(probe).get('action')).toBe('LOGIN')
    expect(query(probe).get('userId')).toBe('5')
  })

  it('escribir el usuario por texto vuelca a la URL solo tras el retardo', () => {
    const probe = setup('/admin/audit-logs')
    act(() => probe.audit.textField.onChange('an'))
    expect(query(probe).has('userName')).toBe(false)
    act(() => vi.advanceTimersByTime(300))
    expect(query(probe).get('userName')).toBe('an')
  })

  it('Limpiar filtros quita todos, también el userId, y conserva ?settings=', () => {
    const probe = setup('/admin/audit-logs?settings=security&userId=5&action=LOGIN&userName=ana')
    act(() => probe.audit.clearFilters())
    expect(probe.audit.activeFilterCount).toBe(0)
    expect(probe.audit.textField.value).toBe('')
    expect(query(probe).get('settings')).toBe('security')
  })
})

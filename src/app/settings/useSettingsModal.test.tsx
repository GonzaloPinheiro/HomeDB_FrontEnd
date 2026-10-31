import { act, cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { useSettingsModal } from './useSettingsModal'

type Probe = {
  modal: ReturnType<typeof useSettingsModal>
  location: ReturnType<typeof useLocation>
  navigate: ReturnType<typeof useNavigate>
}

/** Monta el hook dentro de un router en memoria y expone su valor junto a la ubicación actual. */
function setup(initialEntry: string) {
  const probe = {} as Probe
  function Harness(): ReactNode {
    probe.modal = useSettingsModal()
    probe.location = useLocation()
    probe.navigate = useNavigate()
    return null
  }
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Harness />
    </MemoryRouter>,
  )
  return probe
}

afterEach(cleanup)

describe('useSettingsModal', () => {
  it('sin parámetro está cerrado', () => {
    expect(setup('/files').modal.section).toBeNull()
  })

  it('un valor desconocido también cuenta como cerrado', () => {
    expect(setup('/files?settings=nada').modal.section).toBeNull()
  })

  it('lee la sección de la URL (enlace directo)', () => {
    expect(setup('/?settings=security').modal.section).toBe('security')
  })

  it('open abre en Perfil por defecto o en la sección pedida', () => {
    const probe = setup('/')
    act(() => probe.modal.open())
    expect(probe.modal.section).toBe('profile')

    const other = setup('/')
    act(() => other.modal.open('permissions'))
    expect(other.modal.section).toBe('permissions')
  })

  it('abrir conserva la ruta y el resto de parámetros (se abre SOBRE la pantalla)', () => {
    const probe = setup('/files?folderId=7')
    act(() => probe.modal.open('storage'))
    expect(probe.location.pathname).toBe('/files')
    expect(new URLSearchParams(probe.location.search).get('folderId')).toBe('7')
    expect(new URLSearchParams(probe.location.search).get('settings')).toBe('storage')
  })

  it('cambiar de sección no añade entradas al historial', () => {
    const probe = setup('/files')
    act(() => probe.modal.open('profile'))
    act(() => probe.modal.select('security'))
    act(() => probe.modal.select('general'))
    expect(probe.modal.section).toBe('general')

    // Con una sola entrada abierta, cerrar vuelve a la pantalla de antes: un único paso atrás.
    act(() => probe.modal.close())
    expect(probe.modal.section).toBeNull()
    expect(probe.location.pathname).toBe('/files')
  })

  it('cerrar un modal abierto desde la app deja el historial como estaba y quita el parámetro', () => {
    const probe = setup('/files?folderId=7')
    act(() => probe.modal.open('profile'))
    act(() => probe.modal.close())
    expect(probe.modal.section).toBeNull()
    expect(probe.location.search).toBe('?folderId=7')
  })

  it('cerrar un enlace directo (sin historial al que volver) quita solo el parámetro', () => {
    const probe = setup('/files?folderId=7&settings=security')
    act(() => probe.modal.close())
    expect(probe.modal.section).toBeNull()
    expect(probe.location.pathname).toBe('/files')
    expect(probe.location.search).toBe('?folderId=7')
  })

  it('«atrás» del navegador cierra el modal en vez de salir de la pantalla', () => {
    const probe = setup('/files')
    act(() => probe.modal.open('profile'))
    expect(probe.modal.section).toBe('profile')
    act(() => void probe.navigate(-1))
    expect(probe.modal.section).toBeNull()
    expect(probe.location.pathname).toBe('/files')
  })

  it('abrir otra vez estando abierto cambia de sección sin apilar otra entrada', () => {
    const probe = setup('/files')
    act(() => probe.modal.open('profile'))
    act(() => probe.modal.open('permissions'))
    expect(probe.modal.section).toBe('permissions')
    act(() => void probe.navigate(-1))
    expect(probe.modal.section).toBeNull() // un solo paso atrás, no dos
  })
})

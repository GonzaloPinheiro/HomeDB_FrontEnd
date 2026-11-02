import { describe, expect, it } from 'vitest'

import { levelBadgeStyle } from './levelBadge'

describe('levelBadgeStyle', () => {
  it('Warning -> ámbar', () => {
    expect(levelBadgeStyle('Warning').className).toContain('warning')
  })

  it('Error -> rojo apagado', () => {
    expect(levelBadgeStyle('Error').className).toBe('bg-critical-bg text-critical-text')
  })

  it('Critical -> rojo con los colores invertidos, distinto de Error', () => {
    const critical = levelBadgeStyle('Critical')
    expect(critical.className).toBe('bg-critical-text text-critical-bg')
    expect(critical.className).not.toBe(levelBadgeStyle('Error').className)
  })

  it('Information (valor real de "info" que escribe el backend) -> neutro', () => {
    const style = levelBadgeStyle('Information')
    expect(style.className).not.toContain('warning')
    expect(style.className).not.toContain('critical')
  })

  it('valor desconocido no reconocido cae en neutro (tolerante a niveles nuevos)', () => {
    const style = levelBadgeStyle('Debug')
    expect(style.className).not.toContain('warning')
    expect(style.className).not.toContain('critical')
  })

  it('la etiqueta es siempre el nivel tal cual llega', () => {
    expect(levelBadgeStyle('Error').label).toBe('Error')
    expect(levelBadgeStyle('Debug').label).toBe('Debug')
  })
})

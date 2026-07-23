import { describe, expect, it } from 'vitest'

import { levelBadgeStyle } from './levelBadge'

describe('levelBadgeStyle', () => {
  it('Warning -> ámbar', () => {
    expect(levelBadgeStyle('Warning').className).toContain('warning')
  })

  it('Critical -> rojo apagado', () => {
    expect(levelBadgeStyle('Critical').className).toContain('critical')
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
})

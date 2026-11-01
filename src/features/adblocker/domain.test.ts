import { describe, expect, it } from 'vitest'

import { parseDomainToAllow, parseDomainToCheck } from './domain'

describe('parseDomainToCheck', () => {
  it('acepta un dominio y lo pasa a minúsculas', () => {
    expect(parseDomainToCheck('  Ads.Ejemplo.COM ')).toEqual({ ok: true, domain: 'ads.ejemplo.com' })
  })

  it('quita esquema, ruta, consulta, ancla y punto final (lo que se pega de la barra del navegador)', () => {
    expect(parseDomainToCheck('https://www.elpais.com/espana/noticia?x=1#top')).toEqual({
      ok: true,
      domain: 'www.elpais.com',
    })
    expect(parseDomainToCheck('doubleclick.net.')).toEqual({ ok: true, domain: 'doubleclick.net' })
  })

  it('rechaza vacío y lo que no es un dominio', () => {
    expect(parseDomainToCheck('   ')).toEqual({ ok: false, message: 'Escribe un dominio para comprobarlo.' })
    for (const invalid of ['localhost', 'ejemplo', 'a b.com', '-malo.com', 'ejemplo.c', '192.168.1.1', 'ejemplo..com']) {
      expect(parseDomainToCheck(invalid).ok, invalid).toBe(false)
    }
  })

  it('rechaza etiquetas de más de 63 caracteres y dominios de más de 253', () => {
    expect(parseDomainToCheck(`${'a'.repeat(64)}.com`).ok).toBe(false)
    expect(parseDomainToCheck(`${'a'.repeat(63)}.com`).ok).toBe(true)
    expect(parseDomainToCheck(`${'abcdefghi.'.repeat(26)}com`).ok).toBe(false)
  })
})

describe('parseDomainToAllow', () => {
  it('guarda lo escrito, solo recortado y en minúsculas', () => {
    expect(parseDomainToAllow(' T.CO ', [])).toEqual({ ok: true, domain: 't.co' })
  })

  it('es estricta: no adivina esquemas ni rutas', () => {
    const result = parseDomainToAllow('https://ejemplo.com', [])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('sin http://')
    expect(parseDomainToAllow('ejemplo.com/ruta', []).ok).toBe(false)
  })

  it('rechaza vacío y duplicados', () => {
    expect(parseDomainToAllow('', []).ok).toBe(false)
    expect(parseDomainToAllow('T.co', ['t.co'])).toEqual({ ok: false, message: 'Ese dominio ya está en la lista.' })
  })
})

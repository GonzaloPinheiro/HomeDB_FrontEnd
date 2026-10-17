import { describe, expect, it } from 'vitest'

import { supportsThumbnail, THUMBNAILS_ENABLED, thumbnailUrl } from './thumbnails'

describe('thumbnails', () => {
  it('solo imagen y vídeo piden miniatura', () => {
    expect(supportsThumbnail('image/png')).toBe(true)
    expect(supportsThumbnail('image/webp')).toBe(true)
    expect(supportsThumbnail('video/mp4')).toBe(true)
    for (const type of ['audio/mpeg', 'application/pdf', 'text/plain', 'application/zip', '']) {
      expect(supportsThumbnail(type)).toBe(false)
    }
  })

  it('la URL cuelga de la API configurada', () => {
    expect(thumbnailUrl(42)).toBe('http://localhost:5000/api/files/42/thumbnail')
  })

  // Recordatorio deliberado: el endpoint aún no existe (CLAUDE.md §5.4). Quien lo
  // active tiene que haber verificado la ruta y actualizar esta prueba a propósito.
  it('está desactivado mientras el backend no tenga el endpoint', () => {
    expect(THUMBNAILS_ENABLED).toBe(false)
  })
})

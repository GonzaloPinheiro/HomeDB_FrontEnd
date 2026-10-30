import { describe, expect, it } from 'vitest'

import { getTorrentActions } from './actions'
import { TORRENT_STATUSES } from './types'

describe('getTorrentActions', () => {
  it.each(TORRENT_STATUSES)('%s: tiene acción principal y la primaria no se repite en el menú', (status) => {
    const { primary, menu, destructive } = getTorrentActions(status)
    expect(primary.label).not.toBe('')
    expect(menu.map((action) => action.id)).not.toContain(primary.id)
    expect(destructive.length).toBeGreaterThan(0)
  })

  it.each(TORRENT_STATUSES)('%s: ninguna acción aparece dos veces entre menú y destructivas', (status) => {
    const { menu, destructive } = getTorrentActions(status)
    const ids = [...menu, ...destructive].map((action) => action.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(TORRENT_STATUSES)('%s: las acciones comunes están siempre disponibles', (status) => {
    const ids = getTorrentActions(status).menu.map((action) => action.id)
    expect(ids).toEqual(expect.arrayContaining(['changeCategory', 'copyMagnet', 'viewSheet']))
  })

  it('la acción principal depende del estado', () => {
    expect(getTorrentActions('downloading').primary.id).toBe('pause')
    expect(getTorrentActions('paused').primary.id).toBe('resume')
    expect(getTorrentActions('seeding').primary.id).toBe('stopSeeding')
    expect(getTorrentActions('error').primary.id).toBe('retry')
    expect(getTorrentActions('contentDeleted').primary.id).toBe('redownload')
  })

  it('con el contenido ya borrado solo se puede quitar de la biblioteca (no hay nada que borrar)', () => {
    expect(getTorrentActions('contentDeleted').destructive.map((action) => action.id)).toEqual(['removeFromLibrary'])
  })

  it('las acciones destructivas que lo necesitan llevan su aclaración', () => {
    const { destructive } = getTorrentActions('downloading')
    expect(destructive.every((action) => action.description !== undefined)).toBe(true)
  })
})

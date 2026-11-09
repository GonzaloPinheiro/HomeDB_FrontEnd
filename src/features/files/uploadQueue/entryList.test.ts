import { describe, expect, it } from 'vitest'

import {
  buildEntryList,
  canCollapseDone,
  COLLAPSE_DONE_THRESHOLD,
  MAX_RENDERED_ENTRIES,
  summarizeEntries,
} from './entryList'
import type { UploadEntryStatus, UploadQueueEntry } from './types'

function entry(id: string, status: UploadEntryStatus): UploadQueueEntry {
  return {
    id,
    file: new File(['x'], `${id}.txt`),
    folderId: null,
    folderName: 'Archivos',
    status,
    progress: 0,
    uploadedBytes: 0,
    speedBytesPerSec: null,
    totalChunks: 0,
    chunks: [],
  }
}

const ids = (rows: UploadQueueEntry[]) => rows.map((row) => row.id)

describe('summarizeEntries', () => {
  it('cuenta cada estado en una pasada', () => {
    const summary = summarizeEntries([
      entry('a', 'queued'),
      entry('b', 'queued'),
      entry('c', 'uploading'),
      entry('d', 'processing'),
      entry('e', 'done'),
      entry('f', 'done'),
      entry('g', 'done'),
      entry('h', 'error'),
      entry('i', 'cancelled'),
    ])
    expect(summary).toEqual({
      total: 9,
      queued: 2,
      uploading: 1,
      processing: 1,
      done: 3,
      error: 1,
      cancelled: 1,
    })
  })

  it('con la cola vacía todo es cero', () => {
    expect(summarizeEntries([])).toEqual({
      total: 0,
      queued: 0,
      uploading: 0,
      processing: 0,
      done: 0,
      error: 0,
      cancelled: 0,
    })
  })
})

describe('canCollapseDone', () => {
  it('solo con más entradas que el umbral', () => {
    expect(canCollapseDone(COLLAPSE_DONE_THRESHOLD)).toBe(false)
    expect(canCollapseDone(COLLAPSE_DONE_THRESHOLD + 1)).toBe(true)
  })
})

describe('buildEntryList', () => {
  it('con showDone pinta todas, en el orden de la cola', () => {
    const entries = [entry('a', 'done'), entry('b', 'uploading'), entry('c', 'queued')]
    const view = buildEntryList(entries, { showDone: true })
    expect(ids(view.rows)).toEqual(['a', 'b', 'c'])
    expect(view.hiddenDone).toBe(0)
    expect(view.hiddenOverflow).toBe(0)
  })

  it('sin showDone quita las completadas y las cuenta', () => {
    const entries = [entry('a', 'done'), entry('b', 'uploading'), entry('c', 'done'), entry('d', 'error')]
    const view = buildEntryList(entries, { showDone: false })
    expect(ids(view.rows)).toEqual(['b', 'd'])
    expect(view.hiddenDone).toBe(2)
  })

  it('no reordena por estado: un error no salta al principio', () => {
    // Reordenar movería las filas bajo el cursor y el "cancelar" pulsado sería el de otro archivo.
    const entries = [entry('a', 'queued'), entry('b', 'uploading'), entry('c', 'error'), entry('d', 'queued')]
    expect(ids(buildEntryList(entries, { showDone: true }).rows)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('no modifica el array recibido', () => {
    const entries = [entry('a', 'done'), entry('b', 'queued')]
    const copy = [...entries]
    buildEntryList(entries, { showDone: true })
    buildEntryList(entries, { showDone: false, limit: 1 })
    expect(entries).toEqual(copy)
  })

  describe('tope de filas', () => {
    it('si no caben, prefiere errores y lo que está en marcha antes que lo que espera', () => {
      const entries = [
        entry('q1', 'queued'),
        entry('q2', 'queued'),
        entry('u1', 'uploading'),
        entry('q3', 'queued'),
        entry('e1', 'error'),
        entry('p1', 'processing'),
        entry('q4', 'queued'),
      ]
      const view = buildEntryList(entries, { showDone: false, limit: 3 })
      // errores, en marcha y procesando caben justo; las que esperan se quedan fuera
      expect(ids(view.rows)).toEqual(['u1', 'e1', 'p1'])
      expect(view.hiddenOverflow).toBe(4)
    })

    it('las elegidas se pintan en el orden de la cola, no por prioridad', () => {
      const entries = [entry('q1', 'queued'), entry('e1', 'error'), entry('q2', 'queued'), entry('e2', 'error')]
      const view = buildEntryList(entries, { showDone: false, limit: 3 })
      expect(ids(view.rows)).toEqual(['q1', 'e1', 'e2'])
    })

    it('dentro de una misma prioridad se queda con las primeras de la cola', () => {
      const entries = Array.from({ length: 10 }, (_, i) => entry(`q${i}`, 'queued'))
      const view = buildEntryList(entries, { showDone: false, limit: 4 })
      expect(ids(view.rows)).toEqual(['q0', 'q1', 'q2', 'q3'])
      expect(view.hiddenOverflow).toBe(6)
    })

    it('las completadas (si se piden) son las últimas en entrar', () => {
      const entries = [
        entry('d1', 'done'),
        entry('d2', 'done'),
        entry('q1', 'queued'),
        entry('u1', 'uploading'),
      ]
      const view = buildEntryList(entries, { showDone: true, limit: 2 })
      expect(ids(view.rows)).toEqual(['q1', 'u1'])
      expect(view.hiddenOverflow).toBe(2)
    })

    it('justo en el tope no hay desbordamiento', () => {
      const entries = Array.from({ length: 5 }, (_, i) => entry(`q${i}`, 'queued'))
      const view = buildEntryList(entries, { showDone: false, limit: 5 })
      expect(view.rows).toHaveLength(5)
      expect(view.hiddenOverflow).toBe(0)
    })

    it('por defecto limita a MAX_RENDERED_ENTRIES: 1000 archivos no son 1000 filas', () => {
      const entries = Array.from({ length: 1000 }, (_, i) => entry(`q${i}`, i < 700 ? 'done' : 'queued'))
      const view = buildEntryList(entries, { showDone: false })
      expect(view.hiddenDone).toBe(700)
      expect(view.rows).toHaveLength(MAX_RENDERED_ENTRIES)
      expect(view.hiddenOverflow).toBe(300 - MAX_RENDERED_ENTRIES)
    })
  })
})

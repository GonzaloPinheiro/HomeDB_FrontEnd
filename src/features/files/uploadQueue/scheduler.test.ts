import { describe, expect, it } from 'vitest'

import { DIRECT_UPLOAD_MAX_BYTES } from './directUpload'
import { pickEntriesToStart } from './scheduler'
import type { UploadEntryStatus, UploadQueueEntry } from './types'

const LIMITS = { direct: 3, chunked: 2 }

function entry(id: string, status: UploadEntryStatus, kind: 'direct' | 'chunked' = 'direct'): UploadQueueEntry {
  const file = new File(['x'], `${id}.txt`)
  Object.defineProperty(file, 'size', { value: kind === 'direct' ? 10 : DIRECT_UPLOAD_MAX_BYTES + 1 })
  return {
    id,
    file,
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

const ids = (entries: UploadQueueEntry[]) => entries.map((e) => e.id)
const none: ReadonlySet<string> = new Set()

describe('pickEntriesToStart', () => {
  it('arranca las pequeñas hasta su tope, en orden de cola', () => {
    const entries = ['a', 'b', 'c', 'd', 'e'].map((id) => entry(id, 'queued'))
    expect(ids(pickEntriesToStart(entries, none, LIMITS))).toEqual(['a', 'b', 'c'])
  })

  it('cuenta las que ya están subiendo', () => {
    const entries = [entry('a', 'uploading'), entry('b', 'uploading'), entry('c', 'queued'), entry('d', 'queued')]
    expect(ids(pickEntriesToStart(entries, none, LIMITS))).toEqual(['c'])
  })

  it('cada tipo tiene su propio tope: las grandes no gastan los huecos de las pequeñas', () => {
    const entries = [
      entry('g1', 'uploading', 'chunked'),
      entry('g2', 'uploading', 'chunked'),
      entry('p1', 'queued'),
      entry('p2', 'queued'),
      entry('p3', 'queued'),
      entry('p4', 'queued'),
    ]
    expect(ids(pickEntriesToStart(entries, none, LIMITS))).toEqual(['p1', 'p2', 'p3'])
  })

  it('una grande sin hueco no retiene a las pequeñas de detrás, ni al revés', () => {
    const entries = [
      entry('g1', 'uploading', 'chunked'),
      entry('g2', 'uploading', 'chunked'),
      entry('g3', 'queued', 'chunked'), // sin hueco
      entry('p1', 'queued'), // hueco libre
    ]
    expect(ids(pickEntriesToStart(entries, none, LIMITS))).toEqual(['p1'])

    const reverse = [
      entry('p1', 'uploading'),
      entry('p2', 'uploading'),
      entry('p3', 'uploading'),
      entry('p4', 'queued'), // sin hueco
      entry('g1', 'queued', 'chunked'), // hueco libre
    ]
    expect(ids(pickEntriesToStart(reverse, none, LIMITS))).toEqual(['g1'])
  })

  it('las que están en proceso (ensamblándose en el servidor) NO ocupan hueco', () => {
    const entries = [entry('g1', 'processing', 'chunked'), entry('g2', 'processing', 'chunked'), entry('g3', 'queued', 'chunked')]
    expect(ids(pickEntriesToStart(entries, none, LIMITS))).toEqual(['g3'])
  })

  it('solo mira las que están en cola, y no repite las ya lanzadas', () => {
    const entries = [entry('a', 'done'), entry('b', 'error'), entry('c', 'cancelled'), entry('d', 'queued'), entry('e', 'queued')]
    expect(ids(pickEntriesToStart(entries, new Set(['d']), LIMITS))).toEqual(['e'])
  })

  it('sin hueco no arranca nada', () => {
    const entries = [
      entry('a', 'uploading'),
      entry('b', 'uploading'),
      entry('c', 'uploading'),
      entry('d', 'queued'),
    ]
    expect(pickEntriesToStart(entries, none, LIMITS)).toEqual([])
  })

  it('con la cola vacía no hace nada', () => {
    expect(pickEntriesToStart([], none, LIMITS)).toEqual([])
  })

  it('no modifica lo que recibe', () => {
    const entries = [entry('a', 'queued'), entry('b', 'queued')]
    const started = new Set<string>()
    pickEntriesToStart(entries, started, LIMITS)
    expect(started.size).toBe(0)
    expect(entries.map((e) => e.status)).toEqual(['queued', 'queued'])
  })
})

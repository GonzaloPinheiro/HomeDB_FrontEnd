import { describe, expect, it } from 'vitest'

import {
  DISK_STATUS_META,
  getDiskMessage,
  getDiskStatus,
  getMinFreeMarkerPercent,
  getUsagePercent,
  groupByDisk,
  summarizeDiskProblems,
  translateReason,
  type StorageDisk,
} from './disks'
import type { StorageLocation } from './types'

const GB = 1_000_000_000

function row(overrides: Partial<StorageLocation>): StorageLocation {
  return {
    locationKey: 'main',
    diskKey: 'm2-1',
    usage: 'personal',
    isDefault: true,
    isAvailable: true,
    isWritable: true,
    reason: null,
    checkedAtUtc: '2026-11-21T10:00:00Z',
    totalBytes: 500 * GB,
    usedBytes: 100 * GB,
    freeBytes: 400 * GB,
    minFreeBytes: 5 * GB,
    maxUsedBytes: null,
    ...overrides,
  }
}

function disk(overrides: Partial<StorageDisk> = {}): StorageDisk {
  return {
    key: 'm2-1',
    isAvailable: true,
    isWritable: true,
    reason: null,
    checkedAtUtc: '2026-11-21T10:00:00Z',
    totalBytes: 500 * GB,
    usedBytes: 100 * GB,
    freeBytes: 400 * GB,
    minFreeBytes: 5 * GB,
    locations: [],
    ...overrides,
  }
}

describe('groupByDisk', () => {
  const rows = [
    row({ locationKey: 'main', diskKey: 'm2-1', usage: 'personal' }),
    row({ locationKey: 'temp', diskKey: 'm2-1', usage: 'temp' }),
    row({ locationKey: 'media', diskKey: 'hdd1', usage: 'media', totalBytes: 4000 * GB, usedBytes: 1000 * GB }),
    row({ locationKey: 'backups', diskKey: 'hdd2', usage: 'backups', isAvailable: false, totalBytes: null }),
  ]

  it('agrupa por disco conservando el orden de la configuración', () => {
    expect(groupByDisk(rows).map((d) => d.key)).toEqual(['m2-1', 'hdd1', 'hdd2'])
  })

  it('reparte las ubicaciones entre sus discos', () => {
    const [m2, hdd1, hdd2] = groupByDisk(rows)
    expect(m2.locations.map((l) => l.key)).toEqual(['main', 'temp'])
    expect(hdd1.locations.map((l) => l.key)).toEqual(['media'])
    expect(hdd2.locations.map((l) => l.usage)).toEqual(['backups'])
  })

  it('NO suma los totales: las ubicaciones de un disco repiten las mismas cifras', () => {
    const [m2] = groupByDisk(rows)
    expect(m2.totalBytes).toBe(500 * GB) // no 1000 GB
    expect(m2.usedBytes).toBe(100 * GB)
  })

  it('conserva la disponibilidad y las cifras null de un disco caído', () => {
    const hdd2 = groupByDisk(rows)[2]
    expect(hdd2.isAvailable).toBe(false)
    expect(hdd2.totalBytes).toBeNull()
  })

  it('sin filas, sin discos', () => {
    expect(groupByDisk([])).toEqual([])
  })

  it('arrastra el tope de cada ubicación, no el del disco', () => {
    const [m2] = groupByDisk([
      row({ locationKey: 'main', maxUsedBytes: 200 * GB }),
      row({ locationKey: 'temp', usage: 'temp', maxUsedBytes: null }),
    ])
    expect(m2.locations.map((l) => l.maxUsedBytes)).toEqual([200 * GB, null])
  })
})

describe('getUsagePercent', () => {
  it('usado / total', () => {
    expect(getUsagePercent(disk({ usedBytes: 125 * GB }))).toBe(25)
  })

  it('null sin alguna de las dos cifras o con total 0', () => {
    expect(getUsagePercent(disk({ totalBytes: null }))).toBeNull()
    expect(getUsagePercent(disk({ usedBytes: null }))).toBeNull()
    expect(getUsagePercent(disk({ totalBytes: 0 }))).toBeNull()
  })

  it('se acota a 0-100', () => {
    expect(getUsagePercent(disk({ usedBytes: 900 * GB }))).toBe(100)
  })
})

describe('getDiskStatus — de más a menos grave', () => {
  it('correcto', () => {
    expect(getDiskStatus(disk())).toBe('ok')
  })

  it('un disco no disponible gana a todo, aunque llegue sin capacidad', () => {
    expect(getDiskStatus(disk({ isAvailable: false, isWritable: false, totalBytes: null }))).toBe('unavailable')
  })

  it('disponible pero sin escritura -> solo lectura', () => {
    expect(getDiskStatus(disk({ isWritable: false }))).toBe('readOnly')
  })

  it('por debajo del libre mínimo -> sin espacio libre (aunque el % de uso sea bajo)', () => {
    expect(getDiskStatus(disk({ usedBytes: 100 * GB, freeBytes: 4 * GB }))).toBe('belowMinFree')
  })

  it('justo en el mínimo todavía es válido (como en el backend)', () => {
    expect(getDiskStatus(disk({ freeBytes: 5 * GB }))).toBe('ok')
  })

  it('con minFreeBytes = 0 (desactivado) nunca es "sin espacio libre"', () => {
    expect(getDiskStatus(disk({ minFreeBytes: 0, freeBytes: 1 }))).toBe('ok')
  })

  it('por encima del umbral de uso del Monitor (85 %) -> uso alto; justo en el umbral, no', () => {
    expect(getDiskStatus(disk({ usedBytes: 430 * GB, freeBytes: 70 * GB }))).toBe('highUsage')
    expect(getDiskStatus(disk({ usedBytes: 425 * GB, freeBytes: 75 * GB }))).toBe('ok')
  })

  it('disponible pero sin capacidad (cayó entre comprobaciones) -> sin datos de capacidad', () => {
    expect(getDiskStatus(disk({ totalBytes: null, usedBytes: null, freeBytes: null }))).toBe('noCapacity')
  })

  it('cada estado tiene etiqueta y tono', () => {
    for (const meta of Object.values(DISK_STATUS_META)) {
      expect(meta.label.length).toBeGreaterThan(0)
      expect(['positive', 'warning', 'critical', 'neutral']).toContain(meta.tone)
    }
  })
})

describe('getMinFreeMarkerPercent', () => {
  it('posición de la reserva sobre la barra', () => {
    expect(getMinFreeMarkerPercent({ totalBytes: 100 * GB, minFreeBytes: 5 * GB })).toBe(95)
  })

  it('null sin mínimo o sin total', () => {
    expect(getMinFreeMarkerPercent({ totalBytes: 100 * GB, minFreeBytes: 0 })).toBeNull()
    expect(getMinFreeMarkerPercent({ totalBytes: null, minFreeBytes: 5 * GB })).toBeNull()
  })

  it('un mínimo mayor que el disco deja la marca en el origen', () => {
    expect(getMinFreeMarkerPercent({ totalBytes: 1 * GB, minFreeBytes: 5 * GB })).toBe(0)
  })
})

describe('translateReason', () => {
  it('traduce los cinco motivos del backend y el de capacidad', () => {
    const reasons = [
      'disk path is not accessible',
      'marker file is missing',
      'marker file does not match the disk',
      'marker file could not be read',
      'disk is not writable',
      'capacity could not be read',
    ]
    for (const reason of reasons) {
      const text = translateReason(reason)
      expect(text).not.toBeNull()
      expect(text).not.toContain('marker file') // nunca el inglés crudo
      expect(text).not.toBe(reason)
    }
  })

  it('un motivo desconocido no se muestra crudo', () => {
    expect(translateReason('something new')).toBe('El servidor no indicó un motivo reconocido.')
  })

  it('una clave heredada de Object.prototype no cuenta como motivo conocido', () => {
    expect(translateReason('constructor')).toBe('El servidor no indicó un motivo reconocido.')
  })

  it('sin motivo -> null', () => {
    expect(translateReason(null)).toBeNull()
    expect(translateReason('  ')).toBeNull()
  })
})

describe('getDiskMessage', () => {
  it('no disponible -> aviso crítico con el motivo traducido', () => {
    const message = getDiskMessage(disk({ isAvailable: false, isWritable: false, reason: 'marker file is missing' }))
    expect(message?.tone).toBe('critical')
    expect(message?.text).toContain('marcador')
  })

  it('no disponible sin motivo -> texto genérico, no vacío', () => {
    expect(getDiskMessage(disk({ isAvailable: false, isWritable: false }))?.text.length).toBeGreaterThan(0)
  })

  it('solo lectura -> aviso de advertencia', () => {
    expect(getDiskMessage(disk({ isWritable: false, reason: 'disk is not writable' }))?.tone).toBe('warning')
  })

  it('por debajo del libre mínimo -> aviso crítico que explica el efecto', () => {
    const message = getDiskMessage(disk({ freeBytes: 1 * GB }))
    expect(message?.tone).toBe('critical')
    expect(message?.text).toContain('rechaza')
  })

  it('un disco correcto, con uso alto o sin capacidad no lleva aviso', () => {
    expect(getDiskMessage(disk())).toBeNull()
    expect(getDiskMessage(disk({ usedBytes: 450 * GB, freeBytes: 50 * GB }))).toBeNull()
    expect(getDiskMessage(disk({ totalBytes: null, usedBytes: null, freeBytes: null }))).toBeNull()
  })
})

describe('summarizeDiskProblems', () => {
  it('sin problemas: cero y sin tono', () => {
    expect(summarizeDiskProblems([disk(), disk({ key: 'hdd1' })])).toEqual({ count: 0, tone: null })
    expect(summarizeDiskProblems([])).toEqual({ count: 0, tone: null })
  })

  it('cuenta los discos con problema; crítico si alguno lo es', () => {
    const problems = summarizeDiskProblems([
      disk(),
      disk({ key: 'hdd1', isAvailable: false, isWritable: false }),
      disk({ key: 'hdd2', isWritable: false }),
    ])
    expect(problems).toEqual({ count: 2, tone: 'critical' })
  })

  it('solo advertencias -> tono de advertencia', () => {
    expect(summarizeDiskProblems([disk({ isWritable: false })])).toEqual({ count: 1, tone: 'warning' })
  })

  it('"sin datos de capacidad" no se cuenta como problema', () => {
    expect(summarizeDiskProblems([disk({ totalBytes: null, usedBytes: null, freeBytes: null })]).count).toBe(0)
  })
})

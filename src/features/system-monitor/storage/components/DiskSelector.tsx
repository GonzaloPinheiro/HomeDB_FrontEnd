import { useMemo } from 'react'

import { SegmentedControl, type SegmentedOption } from '@/shared/components/SegmentedControl'

import { DISK_STATUS_META, getDiskStatus, type StorageDisk } from '../disks'
import { DiskStatusIcon } from './DiskStatusIcon'

// Valor interno del botón "Sistema" (el disco principal de la Pi, el del gráfico). Una clave de
// disco real nunca lo iguala: vienen de la configuración del backend (m2-1, hdd1...).
const SYSTEM_VALUE = '__system__'

type DiskSelectorProps = {
  disks: readonly StorageDisk[]
  /** Clave del disco elegido, o `null` para "Sistema". */
  value: string | null
  onChange: (diskKey: string | null) => void
}

// CLAUDE.md §6.13: botones dinámicos junto al título de Disco — "Sistema" (gráfico del disco
// principal) y uno por cada disco que devuelva el backend, con su estado a la vista para que un
// disco caído se vea sin tener que abrirlo.
export function DiskSelector({ disks, value, onChange }: DiskSelectorProps) {
  const options = useMemo<SegmentedOption<string>[]>(
    () => [
      { value: SYSTEM_VALUE, label: 'Sistema' },
      ...disks.map((disk) => {
        const status = getDiskStatus(disk)
        return {
          value: disk.key,
          label: disk.key,
          leading: <DiskStatusIcon status={status} />,
          ariaLabel: `${disk.key}, ${DISK_STATUS_META[status].label}`,
        }
      }),
    ],
    [disks],
  )

  return (
    <SegmentedControl
      aria-label="Disco a mostrar"
      value={value ?? SYSTEM_VALUE}
      options={options}
      onChange={(next) => onChange(next === SYSTEM_VALUE ? null : next)}
    />
  )
}

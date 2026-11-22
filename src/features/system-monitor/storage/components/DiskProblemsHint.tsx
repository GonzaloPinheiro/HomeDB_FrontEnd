import { cn } from '@/shared/lib/utils'

import type { DiskProblems } from '../disks'

/**
 * Aviso dentro de la tarjeta Disco del Monitor ("1 disco con problemas") para que un disco caído
 * se vea sin abrir su vista. Va sobre su propio fondo semántico (§6.21): el texto de aviso solo
 * contrasta sobre él, no sobre la tarjeta. No se pinta sin problemas.
 */
export function DiskProblemsHint({ problems }: { problems: DiskProblems }) {
  if (problems.tone === null) return null
  return (
    <span
      className={cn(
        'w-fit max-w-full rounded-md px-2 py-0.5 text-xs font-medium',
        problems.tone === 'critical' ? 'bg-critical-bg text-critical-text' : 'bg-warning-bg text-warning-text',
      )}
    >
      {problems.count === 1 ? '1 disco con problemas' : `${problems.count} discos con problemas`}
    </span>
  )
}

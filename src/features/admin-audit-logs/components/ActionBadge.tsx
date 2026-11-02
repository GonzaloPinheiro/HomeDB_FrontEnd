import { File, Folder, LogIn, UserCog, type LucideIcon } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

import {
  actionBadgeClass,
  actionCategory,
  actionLabel,
  actionSeverity,
  type ActionCategory,
} from '../actions'

const CATEGORY_ICON: Record<ActionCategory, LucideIcon> = {
  session: LogIn,
  account: UserCog,
  files: File,
  folders: Folder,
}

const BASE_CLASS =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-transparent px-2.5 py-0.5 text-xs font-semibold'

type ActionBadgeProps = {
  action: string
  /** Con él, la insignia es un botón (filtra la tabla por esa acción); sin él, solo informa. */
  onSelect?: () => void
}

// CLAUDE.md §6.24: la acción con su etiqueta legible, un icono por categoría y color solo si es sensible o
// destructiva (§6.7). El código del backend (`UPLOAD_FILE`) va en el tooltip y en el detalle de la fila.
export function ActionBadge({ action, onSelect }: ActionBadgeProps) {
  const category = actionCategory(action)
  const Icon = category === null ? null : CATEGORY_ICON[category]
  const label = actionLabel(action)
  const className = cn(BASE_CLASS, actionBadgeClass(actionSeverity(action)))
  const content = (
    <>
      {Icon !== null && <Icon className="h-3 w-3" aria-hidden />}
      {label}
    </>
  )

  if (onSelect === undefined) {
    return (
      <span className={className} title={action}>
        {content}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      // El nombre accesible dice QUÉ hace el botón y contiene el texto visible (WCAG 2.5.3)
      aria-label={`Ver solo la acción «${label}»`}
      title={`Ver solo «${label}» (${action})`}
      className={cn(
        className,
        'transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {content}
    </button>
  )
}

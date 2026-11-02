import { cn } from '@/shared/lib/utils'

import { getOwnerInitials } from '../presentation'

// Círculo con las iniciales del dueño; "–" y atenuado si el dispositivo no tiene dueño.
export function OwnerAvatar({ ownerName, className }: { ownerName: string | null; className?: string }) {
  return (
    <span
      className={cn(
        'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-border bg-surface text-[10px] font-semibold',
        ownerName === null ? 'text-text-muted-2' : 'text-text-secondary',
        className,
      )}
      aria-hidden
    >
      {getOwnerInitials(ownerName)}
    </span>
  )
}

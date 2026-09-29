import { Loader2 } from 'lucide-react'

import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'

import type { BackupStatus } from '../types'

const STATUS_STYLE: Record<BackupStatus, { label: string; className: string }> = {
  // §6.1: Positive (verde apagado) y Critical — color con propósito (§6.7),
  // igual que las insignias de nivel de log; "en curso" neutro, sin tinte propio.
  running: { label: 'En curso', className: 'border-border-light bg-surface text-text-secondary' },
  success: { label: 'Correcto', className: 'border-transparent bg-positive-bg text-positive-text' },
  failed: { label: 'Fallido', className: 'border-transparent bg-critical-bg text-critical-text' },
}

export function BackupStatusBadge({ status, className }: { status: BackupStatus; className?: string }) {
  const style = STATUS_STYLE[status]
  return (
    <Badge className={cn('gap-1 whitespace-nowrap font-medium shadow-none', style.className, className)}>
      {status === 'running' && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
      {style.label}
    </Badge>
  )
}

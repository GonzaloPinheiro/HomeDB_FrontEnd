import { Progress } from '@/shared/components/ui/progress'
import { cn } from '@/shared/lib/utils'

import { getProgressCaption, getProgressView, type ProgressTone } from '../presentation'
import type { Torrent } from '../types'

const TONE_CLASSES: Record<ProgressTone, string> = {
  accent: 'bg-accent',
  neutral: 'bg-text-muted-2',
  positive: 'bg-positive-text',
  critical: 'bg-critical-text',
}

// CLAUDE.md §6.19: barra + cifra + una línea de detalle por estado. La pista usa
// `bg-border` y no el `bg-surface-alt` por defecto de Progress: en oscuro
// --surface-alt vale lo mismo que --card (§6.1) y la pista se perdería.
export function TorrentProgress({ torrent, className }: { torrent: Torrent; className?: string }) {
  const view = getProgressView(torrent)
  const caption = getProgressCaption(torrent)

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-center gap-2">
        <Progress
          value={view.value}
          aria-label={`Progreso de ${torrent.name}`}
          className="h-1.5 flex-1 bg-border"
          indicatorClassName={TONE_CLASSES[view.tone]}
        />
        <span className="w-11 shrink-0 text-right font-mono text-xs text-text-primary">{view.label}</span>
      </div>
      <p
        className={cn(
          'mt-1 truncate font-mono text-[11px]',
          // --critical-text es igual en ambos temas y solo contrasta sobre claro; en oscuro basta el badge y la barra roja
          view.tone === 'critical' ? 'text-critical-text dark:text-text-secondary' : 'text-text-muted',
        )}
        title={caption}
      >
        {caption}
      </p>
    </div>
  )
}

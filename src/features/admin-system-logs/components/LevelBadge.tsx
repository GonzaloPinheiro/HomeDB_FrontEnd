import { Badge } from '@/shared/components/ui/badge'

import { levelBadgeStyle } from '../levelBadge'

// CLAUDE.md §6.7: excepción de color en Admin — insignia de nivel de log con
// significado semántico (Warning ámbar, Critical rojo apagado, Info neutro).
export function LevelBadge({ level }: { level: string }) {
  const style = levelBadgeStyle(level)
  return <Badge className={`${style.className} shadow-none`}>{style.label}</Badge>
}

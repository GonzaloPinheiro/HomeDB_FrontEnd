import { Badge } from '@/shared/components/ui/badge'

import { MOCK_SCENARIOS } from './scenario'

// CLAUDE.md §6.21: marca visible de que la pantalla muestra datos de ejemplo, para que
// nadie los confunda con el estado real de AdGuard. En desarrollo, su tooltip recuerda
// cómo ver cada estado. Se retira con el resto de `mock/`.
export function MockBadge() {
  const hint = import.meta.env.DEV ? ` Otros estados: ?mock=${MOCK_SCENARIOS.join(' | ')}` : ''
  return (
    <Badge
      variant="secondary"
      className="border-border font-medium"
      title={`Datos de ejemplo: el backend todavía no tiene la integración con AdGuard.${hint}`}
    >
      Maqueta
    </Badge>
  )
}

import { StatCard } from '@/shared/components/StatCard'

import { useLogsHealth } from '../api'
import { healthTone } from '../presentation'

// CLAUDE.md §6.23: las tres cifras de GET /admin/logs/health. Cuentan niveles concretos —`Error` y
// `Warning`—; las excepciones `Critical` no entran aquí y se ven en su tarjeta (§5.4), de ahí los textos.
export function LogsHealthCards() {
  const health = useLogsHealth()
  // `data === undefined` y no `isError` (§7.1): un refetch fallido deja el último dato visible
  const data = health.data

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label="Errores · última hora"
        value={data?.errorsLastHour}
        isPending={health.isPending}
        tone={healthTone('error', data?.errorsLastHour ?? 0)}
        caption={data?.errorsLastHour === 0 ? 'Sin errores' : 'Nivel Error · sin contar críticos'}
      />
      <StatCard
        label="Errores · 24 h"
        value={data?.errorsLast24h}
        isPending={health.isPending}
        tone={healthTone('error', data?.errorsLast24h ?? 0)}
        caption={data?.errorsLast24h === 0 ? 'Sin errores' : 'Nivel Error · sin contar críticos'}
      />
      <StatCard
        label="Avisos · 24 h"
        value={data?.warningsLast24h}
        isPending={health.isPending}
        tone={healthTone('warning', data?.warningsLast24h ?? 0)}
        caption={data?.warningsLast24h === 0 ? 'Sin avisos' : 'Nivel Warning · fallos esperados'}
      />
    </div>
  )
}

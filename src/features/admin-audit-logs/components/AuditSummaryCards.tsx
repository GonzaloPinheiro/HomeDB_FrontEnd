import { Activity, LogIn } from 'lucide-react'

import { StatCard } from '@/shared/components/StatCard'

import { SUMMARY_WINDOW_HOURS, useAuditSummary } from '../api'
import { sensitiveCaption, sensitiveTone, sensitiveTotal } from '../presentation'

// CLAUDE.md §6.24: tres cifras de las últimas 24 h, contadas con peticiones de una fila (§5.4: el backend no
// tiene endpoint de estadísticas). No son pulsables, como las de Registros (§6.23): cuentan en una ventana
// de HORAS y la tabla filtra por DÍAS UTC, así que filtrarla desde aquí mostraría otro recuento.
export function AuditSummaryCards() {
  const summary = useAuditSummary()
  const total = sensitiveTotal(summary.sensitive)
  const period = `${SUMMARY_WINDOW_HOURS} h`
  // Cada tarjeta enseña su cifra en cuanto la tiene: "cargando" solo mientras falte (si una petición falla,
  // `summary.isPending` acaba en false y la tarjeta pasa a "No se pudo cargar")
  const pending = (value: number | undefined) => summary.isPending && value === undefined

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label={`Acciones · ${period}`}
        value={summary.total}
        isPending={pending(summary.total)}
        tone="neutral"
        icon={Activity}
        caption="Todas las cuentas"
      />
      <StatCard
        label={`Inicios de sesión · ${period}`}
        value={summary.logins}
        isPending={pending(summary.logins)}
        tone="neutral"
        icon={LogIn}
        // El backend solo audita LOGIN cuando el acceso es correcto (AuthService.LoginAsync)
        caption="Accesos correctos"
      />
      <StatCard
        label={`Acciones sensibles · ${period}`}
        value={total}
        isPending={pending(total)}
        tone={sensitiveTone(total)}
        caption={sensitiveCaption(summary.sensitive)}
      />
    </div>
  )
}

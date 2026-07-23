import { useLogsHealth } from '../api'

// CLAUDE.md (Fase 5): resumen simple de 3 cifras en la cabecera, no hace falta
// que sean tarjetas elaboradas. ErrorsLastHour/ErrorsLast24h siempre valen 0
// hoy por un bug del backend (ver api.ts) — se muestran igualmente tal cual
// llegan de la API, sin ocultarlos ni "arreglarlos" desde el front.
export function LogsHealthSummary() {
  const { data } = useLogsHealth()

  return (
    <div className="flex flex-wrap gap-6 text-sm">
      <Stat label="Errores (última hora)" value={data?.errorsLastHour ?? '—'} />
      <Stat label="Errores (24h)" value={data?.errorsLast24h ?? '—'} />
      <Stat label="Avisos (24h)" value={data?.warningsLast24h ?? '—'} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-base font-semibold text-text-primary">{value}</span>
      <span className="text-text-secondary">{label}</span>
    </div>
  )
}

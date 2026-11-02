import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { FloatCard } from '@/shared/components/FloatCard'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Switch } from '@/shared/components/ui/switch'
import { notAvailableYet } from '@/shared/lib/notAvailableYet'
import { cn } from '@/shared/lib/utils'

import { useBlockedServices } from '../api'
import {
  countBlocked,
  countPending,
  describePending,
  filterServices,
  getServiceInitial,
  isServiceBlocked,
  togglePending,
  type PendingChanges,
} from '../services'

// CLAUDE.md §6.21: bloqueo global de servicios (sin horarios ni distinción por dispositivo;
// los horarios se ajustan en el panel nativo de AdGuard). Los interruptores no se envían uno
// a uno: se acumulan como cambios pendientes y se guardan juntos. Buscar, filtrar, marcar y
// descartar funcionan; "Guardar" solo avisa con `notAvailableYet`.
// PENDIENTE (CLAUDE.md §6.21): conectar "Guardar" a `PUT /adblocker/blocked-services` con la
// lista COMPLETA de ids bloqueados, y vaciar `pending` al terminar. Hoy, tras pulsar
// "Guardar", los cambios siguen pendientes.
export function BlockedServicesCard() {
  const services = useBlockedServices()
  const [query, setQuery] = useState('')
  const [onlyBlocked, setOnlyBlocked] = useState(false)
  const [pending, setPending] = useState<PendingChanges>({})

  const list = services.data
  const visible = useMemo(
    () => (list ? filterServices(list, pending, query, onlyBlocked) : []),
    [list, pending, query, onlyBlocked],
  )
  const pendingCount = countPending(pending)

  return (
    <FloatCard className="flex min-w-0 flex-col gap-3 p-5 sm:px-[22px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3.5 gap-y-1.5">
        <h2 className="text-[15px] font-semibold text-text-primary">Servicios bloqueados</h2>
        {list !== undefined && (
          <span className="text-xs text-text-secondary">
            {countBlocked(list, pending)} de {list.length} bloqueados
          </span>
        )}
      </div>
      <p className="-mt-1.5 text-xs leading-snug text-text-secondary">
        Bloqueo global para toda la red, sin horarios ni distinción por dispositivo. Los horarios se ajustan en el panel
        de AdGuard.
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <div className="relative min-w-[200px] max-w-[360px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar servicio"
            aria-label="Buscar servicio"
            className="pl-9"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text-primary">
          <Switch checked={onlyBlocked} onCheckedChange={setOnlyBlocked} />
          Solo bloqueados
        </label>
      </div>

      {services.isPending ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-1.5" aria-busy>
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} className="h-[42px] rounded-[9px]" />
          ))}
        </div>
      ) : list === undefined ? (
        <p className="py-2.5 text-sm text-text-muted">No se pudo cargar la lista de servicios.</p>
      ) : visible.length === 0 ? (
        <p className="py-2.5 text-[13px] text-text-secondary">Ningún servicio coincide con la búsqueda.</p>
      ) : (
        <div className="grid max-h-[372px] grid-cols-[repeat(auto-fill,minmax(176px,1fr))] content-start gap-1.5 overflow-auto">
          {visible.map((service) => {
            const blocked = isServiceBlocked(service, pending)
            const changed = service.id in pending
            return (
              <button
                key={service.id}
                type="button"
                aria-pressed={blocked}
                onClick={() => setPending((current) => togglePending(current, service))}
                className={cn(
                  'flex min-w-0 items-center gap-[9px] rounded-[9px] border px-[9px] py-[7px] text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  blocked ? 'bg-accent-tint-bg' : 'bg-surface hover:bg-row-hover',
                  // Un cambio sin guardar se marca con el borde de acento (§6.1)
                  changed ? 'border-accent' : blocked ? 'border-accent-tint-bg' : 'border-surface',
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border-light bg-card text-[11px] font-bold text-text-secondary">
                  {getServiceInitial(service.name)}
                </span>
                <span className={cn('min-w-0 flex-1 truncate text-[13px]', blocked ? 'font-semibold' : 'font-normal')}>
                  {service.name}
                </span>
                {/* Interruptor decorativo: el botón entero es el control (aria-pressed) */}
                <span
                  className={cn('relative block h-[17px] w-[30px] shrink-0 rounded-full', blocked ? 'bg-accent' : 'bg-border')}
                  aria-hidden
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-[13px] w-[13px] rounded-full bg-card shadow-sm transition-[left]',
                      blocked ? 'left-[15px]' : 'left-0.5',
                    )}
                  />
                </span>
              </button>
            )
          })}
        </div>
      )}

      {pendingCount > 0 && (
        // Barra de cambios sin guardar (§11): pegada abajo para que "Guardar" no se pierda de vista al desplazar
        <div className="sticky bottom-0 z-[1] flex flex-wrap items-center gap-x-3.5 gap-y-2.5 rounded-xl bg-text-primary py-2.5 pl-4 pr-3 text-bg shadow-float">
          <span className="flex-1 text-[13px] font-semibold">{describePending(pendingCount)}</span>
          <Button type="button" variant="ghost" size="sm" className="text-bg hover:bg-header-surface hover:text-bg" onClick={() => setPending({})}>
            Descartar
          </Button>
          <Button type="button" size="sm" onClick={notAvailableYet}>
            Guardar
          </Button>
        </div>
      )}
    </FloatCard>
  )
}

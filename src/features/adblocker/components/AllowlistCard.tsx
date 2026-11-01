import { Trash2 } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'

import { FloatCard } from '@/shared/components/FloatCard'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { notAvailableYet } from '@/shared/lib/notAvailableYet'
import { cn } from '@/shared/lib/utils'

import { useAllowlist } from '../api'
import { parseDomainToAllow } from '../domain'

// CLAUDE.md §6.21: dominios que nunca se bloquean. La validación del formulario y la
// confirmación de quitar funcionan; añadir y quitar solo avisan con `notAvailableYet`.
// Quitar pide confirmación en la propia fila (§11), sin modal, como en el resto de listas.
// PENDIENTE (CLAUDE.md §5.4/§6.21): el diseño del backend solo define `POST` y `DELETE` de la
// lista de permitidos, no un `GET` para leerla. La maqueta asume `GET /adblocker/allowlist`
// -> `string[]`; hay que añadirlo al backend.
export function AllowlistCard() {
  const allowlist = useAllowlist()
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const domains = allowlist.data

  const add = () => {
    const parsed = parseDomainToAllow(input, domains ?? [])
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }
    setError(null)
    notAvailableYet()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') add()
  }

  const remove = () => {
    setConfirming(null)
    notAvailableYet()
  }

  return (
    <FloatCard className="flex min-w-0 flex-col gap-3 p-5 sm:px-[22px]">
      <div className="flex items-baseline justify-between gap-2.5">
        <h2 className="text-[15px] font-semibold text-text-primary">Lista de permitidos</h2>
        {domains !== undefined && (
          <span className="text-xs text-text-secondary">
            {domains.length === 1 ? '1 dominio' : `${domains.length} dominios`}
          </span>
        )}
      </div>
      <p className="-mt-1.5 text-xs text-text-secondary">
        Estos dominios nunca se bloquean, aunque aparezcan en una lista.
      </p>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(event) => {
            setInput(event.target.value)
            setError(null)
          }}
          onKeyDown={handleKeyDown}
          placeholder="ejemplo.com"
          spellCheck={false}
          autoCapitalize="none"
          aria-label="Dominio a permitir"
          aria-invalid={error !== null}
          className={cn('min-w-0 flex-1 font-mono text-[13px]', error !== null && 'border-critical-text')}
        />
        <Button type="button" variant="outline" onClick={add}>
          Añadir
        </Button>
      </div>
      {error !== null && <p className="text-xs text-critical-text">{error}</p>}

      <div className="flex max-h-[230px] flex-col overflow-auto" aria-busy={allowlist.isPending}>
        {allowlist.isPending ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="my-1 h-8 w-full" />)
        ) : domains === undefined ? (
          <p className="py-3.5 text-sm text-text-muted">No se pudo cargar la lista.</p>
        ) : domains.length === 0 ? (
          <p className="py-3.5 text-sm text-text-muted">Aún no hay dominios permitidos.</p>
        ) : (
          domains.map((domain) => (
            <div key={domain} className="flex min-h-10 items-center gap-2.5 border-b border-border-light py-0.5 pr-1">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-primary" title={domain}>
                {domain}
              </span>
              {confirming === domain ? (
                <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                  ¿Quitar?
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                    Cancelar
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={remove}>
                    Quitar
                  </Button>
                </span>
              ) : (
                <button
                  type="button"
                  title="Quitar de permitidos"
                  aria-label={`Quitar ${domain} de permitidos`}
                  onClick={() => setConfirming(domain)}
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] text-text-muted-2 transition-colors hover:bg-critical-bg hover:text-critical-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 className="h-[15px] w-[15px]" aria-hidden />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </FloatCard>
  )
}

import { Plus } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'

import { toApiError } from '@/shared/api/client'
import { FloatCard } from '@/shared/components/FloatCard'
import { InlineMessage } from '@/shared/components/InlineMessage'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { notAvailableYet } from '@/shared/lib/notAvailableYet'
import { cn } from '@/shared/lib/utils'

import { useCheckDomain } from '../api'
import { parseDomainToCheck } from '../domain'

const EXAMPLES = ['doubleclick.net', 'metrics.icloud.com', 'elpais.com']

// CLAUDE.md §6.21: comprueba si un dominio se bloquea y por qué lista. La lectura sí
// funciona con la maqueta (devuelve datos de ejemplo); "Añadir a permitidos" solo avisa.
// PENDIENTE (CLAUDE.md §6.21): conectar "Añadir a permitidos" a `POST /adblocker/allowlist`
// y, al terminar, volver a comprobar el dominio (pasará a "Permitido").
export function DomainCheckerCard() {
  const check = useCheckDomain()
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const run = (raw: string) => {
    const parsed = parseDomainToCheck(raw)
    if (!parsed.ok) {
      setError(parsed.message)
      check.reset()
      return
    }
    setError(null)
    setInput(parsed.domain)
    check.mutate(parsed.domain)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') run(input)
  }

  const result = check.data

  return (
    <FloatCard className="flex min-w-0 flex-col gap-3 p-5 sm:px-[22px]">
      <div>
        <h2 className="text-[15px] font-semibold text-text-primary">Comprobar dominio</h2>
        <p className="mt-[3px] text-xs text-text-secondary">Mira si un dominio se bloquea en tu red y por qué lista.</p>
      </div>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(event) => {
            setInput(event.target.value)
            setError(null)
          }}
          onKeyDown={handleKeyDown}
          placeholder="p. ej. ads.ejemplo.com"
          spellCheck={false}
          autoCapitalize="none"
          aria-label="Dominio a comprobar"
          aria-invalid={error !== null}
          className={cn('min-w-0 flex-1 font-mono text-[13px]', error !== null && 'border-critical-text')}
        />
        <Button type="button" onClick={() => run(input)} disabled={check.isPending}>
          Comprobar
        </Button>
      </div>
      {error !== null && <InlineMessage tone="critical">{error}</InlineMessage>}

      {check.isPending && (
        <div className="animate-pulse rounded-[10px] bg-surface px-3.5 py-3 text-[13px] text-text-secondary">
          Comprobando {check.variables}…
        </div>
      )}

      {check.isError && (
        <div className="rounded-[10px] bg-critical-bg px-3.5 py-3 text-[13px] text-critical-text">
          {toApiError(check.error).message}
        </div>
      )}

      {result !== undefined && result.isBlocked && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[10px] bg-critical-bg px-3.5 py-3">
          <div className="min-w-[180px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-critical-text px-2 py-0.5 text-xs font-bold text-critical-bg">Bloqueado</span>
              <span className="break-all font-mono text-xs text-critical-text">{result.domain}</span>
            </div>
            {result.matchedFilterName !== null && (
              <p className="mt-1.5 text-[13px] text-critical-text">
                Lo bloquea la lista <strong>{result.matchedFilterName}</strong>
              </p>
            )}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={notAvailableYet}>
            <Plus aria-hidden />
            Añadir a permitidos
          </Button>
        </div>
      )}

      {result !== undefined && !result.isBlocked && (
        <div className="rounded-[10px] bg-positive-bg px-3.5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-positive-text px-2 py-0.5 text-xs font-bold text-positive-bg">Permitido</span>
            <span className="break-all font-mono text-xs text-positive-text">{result.domain}</span>
          </div>
          <p className="mt-1.5 text-[13px] text-positive-text">
            {result.isAllowlisted ? 'Está en tu lista de permitidos.' : 'Ninguna lista activa lo bloquea.'}
          </p>
        </div>
      )}

      {result === undefined && !check.isPending && !check.isError && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-secondary">
          Prueba con
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => run(example)}
              className="rounded-md border border-border-light bg-surface px-2 py-[3px] font-mono text-[11px] text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {example}
            </button>
          ))}
        </div>
      )}
    </FloatCard>
  )
}

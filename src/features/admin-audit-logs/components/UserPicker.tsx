import { useState } from 'react'

import { toApiError } from '@/shared/api/client'
import { InlineMessage } from '@/shared/components/InlineMessage'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { cn } from '@/shared/lib/utils'

import { useUserSuggestions } from '../api'
import type { UserSuggestion } from '../types'

type UserPickerProps = {
  selectedUserId: number | null
  onSelect: (user: UserSuggestion) => void
}

// CLAUDE.md §6.24: elegir un usuario EXACTO (por id). La búsqueda por texto de la barra encuentra por
// subcadena ("ana" también trae a "mariana"); esto no. Se monta solo para quien tiene el módulo
// UserManagement (lo decide `AuditFilterBar`): `GET /admin/users` lo exige (§5.4).
//
// Lista de botones, no un combobox con navegación por flechas: un combobox propio multiplica los fallos de
// teclado y lector de pantalla, y aquí basta con que cada sugerencia sea un botón alcanzable con Tab.
export function UserPicker({ selectedUserId, onSelect }: UserPickerProps) {
  const [term, setTerm] = useState('')
  const debounced = useDebounce(term, 250)
  const suggestions = useUserSuggestions(debounced, true)
  const hasTerm = debounced.trim().length > 0

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="filter-user-picker" className="text-xs text-text-secondary">
        Usuario exacto
      </Label>
      <Input
        id="filter-user-picker"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Buscar para elegir…"
        autoComplete="off"
      />
      <div aria-live="polite" aria-busy={suggestions.isFetching}>
        {!hasTerm ? (
          <p className="text-xs text-text-muted">Escribe para elegir un usuario concreto.</p>
        ) : suggestions.isPending ? (
          <div className="flex flex-col gap-1.5" aria-hidden>
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
          </div>
        ) : suggestions.data === undefined ? (
          <InlineMessage tone="critical">{toApiError(suggestions.error).message}</InlineMessage>
        ) : suggestions.data.length === 0 ? (
          <p className="text-xs text-text-muted">Ningún usuario coincide.</p>
        ) : (
          <ul className={cn('flex flex-col gap-0.5', suggestions.isPlaceholderData && 'opacity-50')}>
            {suggestions.data.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  aria-pressed={user.id === selectedUserId}
                  onClick={() => onSelect(user)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                    'hover:bg-row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    user.id === selectedUserId && 'bg-accent-tint-bg text-accent-tint-text',
                  )}
                >
                  <span className="truncate font-medium">{user.username}</span>
                  <span className="font-mono text-xs text-text-muted-2">#{user.id}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

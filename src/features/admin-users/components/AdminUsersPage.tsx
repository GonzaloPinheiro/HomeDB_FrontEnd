import { CircleAlert, MoreVertical, Trash2, UserRoundPlus, UserRoundSearch, UserRoundX } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { RequireAdmin } from '@/app/guards'
import { UserDetailModal } from '@/features/admin-permissions/components/UserDetailModal'
import { toApiError } from '@/shared/api/client'
import { EmptyState } from '@/shared/components/EmptyState'
import { FilterBar } from '@/shared/components/FilterBar'
import { Pagination } from '@/shared/components/Pagination'
import { RoleBadge } from '@/shared/components/RoleBadge'
import { DataTable, type Column, type SortState } from '@/shared/components/Table'
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { formatShortDate } from '@/shared/lib/formatDate'

import { useUsers, type UsersFilters } from '../api'
import type { UserSummary } from '../types'
import { CreateUserModal } from './CreateUserModal'
import { DeleteUserModal } from './DeleteUserModal'

type ModalState = { type: 'create' } | { type: 'delete'; user: UserSummary } | { type: 'detail'; user: UserSummary } | null

export function AdminUsersPage() {
  // CLAUDE.md §7.10: filtros y página viven en los query params de la URL —
  // una vista filtrada sobrevive a un refresco y se comparte por enlace
  const [searchParams, setSearchParams] = useSearchParams()
  const filters: UsersFilters = {
    search: searchParams.get('q') ?? '',
    role: searchParams.get('role'),
    from: searchParams.get('from'),
    to: searchParams.get('to'),
  }
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)

  const updateParams = (patch: Record<string, string | null>) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(patch)) {
          if (value === null || value === '') next.delete(key)
          else next.set(key, value)
        }
        return next
      },
      { replace: true },
    )
  }

  // Buscador combinado con debounce (§11) que se vuelca a la URL
  const [searchInput, setSearchInput] = useState(filters.search)
  const debouncedSearch = useDebounce(searchInput)
  const urlSearch = searchParams.get('q') ?? ''
  useEffect(() => {
    if (debouncedSearch === urlSearch) return
    // Sincronización con la URL (sistema externo al componente); cambiar un
    // filtro siempre resetea la página
    updateParams({ q: debouncedSearch, page: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateParams es estable a efectos prácticos
  }, [debouncedSearch, urlSearch])

  const [sort, setSort] = useState<SortState | undefined>()
  const onSort = (key: string) => {
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )
  }

  const query = useUsers(filters, page)

  // Orden en cliente sobre la página cargada (el backend no admite parámetros
  // de orden — mismo criterio que Archivos, §6.6)
  const rows = useMemo(() => {
    const users = [...(query.data?.users ?? [])]
    if (!sort) return users
    const sign = sort.direction === 'asc' ? 1 : -1
    const collator = new Intl.Collator('es', { sensitivity: 'base' })
    users.sort((a, b) => {
      if (sort.key === 'username') return sign * collator.compare(a.username, b.username)
      if (sort.key === 'email') return sign * collator.compare(a.email, b.email)
      return sign * a.createdAt.localeCompare(b.createdAt)
    })
    return users
  }, [query.data, sort])

  const [modal, setModal] = useState<ModalState>(null)

  const activeFilterCount = [filters.search, filters.role, filters.from, filters.to].filter(
    (value) => value !== null && value !== '',
  ).length

  const clearFilters = () => {
    setSearchInput('')
    setSearchParams({}, { replace: true })
  }

  const columns: Array<Column<UserSummary>> = [
    {
      key: 'username',
      header: 'Usuario',
      sortable: true,
      cell: (user) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-surface text-xs font-medium text-text-secondary">
              {user.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-text-primary">{user.username}</span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      className: 'hidden md:table-cell',
      cell: (user) => <span className="text-text-secondary">{user.email || '—'}</span>,
    },
    {
      key: 'roles',
      header: 'Rol',
      cell: (user) => (
        <div className="flex gap-1">
          {user.roles.map((role) => (
            <RoleBadge key={role} role={role} />
          ))}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Creado',
      sortable: true,
      className: 'hidden sm:table-cell',
      cell: (user) => <span className="text-text-muted-2">{formatShortDate(user.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      cell: (user) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              // CLAUDE.md §10/§11: tabla densa (§6.6) => icono visual pequeño, pero el área
              // táctil real se expande a ~44px con un pseudo-elemento que no afecta al layout
              className="relative h-7 w-7 text-text-faint after:absolute after:-inset-2 after:content-[''] hover:text-text-primary"
              aria-label={`Acciones de ${user.username}`}
            >
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setModal({ type: 'detail', user })}>
              Ver detalle
            </DropdownMenuItem>
            {/* Eliminar exige rol Admin + módulo (§5.3, verificado en UsersController) */}
            <RequireAdmin fallback={null}>
              <DropdownMenuItem
                onSelect={() => setModal({ type: 'delete', user })}
                className="text-critical-text"
              >
                <Trash2 />
                Eliminar
              </DropdownMenuItem>
            </RequireAdmin>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-text-primary">Usuarios</h1>
        {/* Crear usuario exige rol Admin, no solo el módulo (§5.3) */}
        <RequireAdmin fallback={null}>
          <Button onClick={() => setModal({ type: 'create' })}>
            <UserRoundPlus />
            Nuevo usuario
          </Button>
        </RequireAdmin>
      </div>

      <FilterBar
        activeFilterCount={activeFilterCount}
        onClear={clearFilters}
        panel={
          <>
            <p className="text-sm font-medium text-text-primary">Rango de fechas de creación</p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="filter-from" className="text-xs text-text-secondary">
                Desde
              </Label>
              <Input
                id="filter-from"
                type="date"
                value={filters.from ?? ''}
                onChange={(event) => updateParams({ from: event.target.value, page: null })}
              />
              <Label htmlFor="filter-to" className="text-xs text-text-secondary">
                Hasta
              </Label>
              <Input
                id="filter-to"
                type="date"
                value={filters.to ?? ''}
                onChange={(event) => updateParams({ to: event.target.value, page: null })}
              />
            </div>
          </>
        }
      >
        {/* §6.6: búsqueda combinada username/email (con "@" -> Email) + select de rol */}
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Buscar por usuario o email"
          className="h-9 w-full sm:w-64"
          aria-label="Buscar por usuario o email"
        />
        <Select
          value={filters.role ?? 'all'}
          onValueChange={(value) => updateParams({ role: value === 'all' ? null : value, page: null })}
        >
          <SelectTrigger className="h-9 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Admin">Admin</SelectItem>
            <SelectItem value="User">User</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      {query.isPending ? (
        // §6.10: skeleton con forma de filas de tabla
        <div className="flex flex-col gap-1 rounded-xl border border-border p-3" aria-hidden>
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 px-2 py-1.5">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="hidden h-4 flex-1 md:block" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <EmptyState
          icon={CircleAlert}
          title="No se pudo cargar la lista"
          description={toApiError(query.error).message}
          action={
            <Button variant="outline" onClick={() => void query.refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={activeFilterCount > 0 ? UserRoundSearch : UserRoundX}
          title="Sin resultados"
          description={
            activeFilterCount > 0
              ? 'Ningún usuario coincide con los filtros activos.'
              : 'Todavía no hay usuarios.'
          }
          action={
            activeFilterCount > 0 ? (
              <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border">
            <DataTable columns={columns} rows={rows} rowKey={(user) => user.id} sort={sort} onSort={onSort} />
          </div>
          <Pagination
            page={page}
            totalPages={query.data.totalPages}
            totalCount={query.data.totalCount}
            onPageChange={(next) => updateParams({ page: String(next) })}
          />
        </>
      )}

      <CreateUserModal open={modal?.type === 'create'} onClose={() => setModal(null)} />
      {modal?.type === 'delete' && (
        <DeleteUserModal open onClose={() => setModal(null)} user={modal.user} />
      )}
      {modal?.type === 'detail' && (
        <UserDetailModal key={modal.user.id} open onClose={() => setModal(null)} user={modal.user} />
      )}
    </div>
  )
}

import {
  ChevronDown,
  Database,
  LogOut,
  PanelLeft,
  Search,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { useAuth } from '@/shared/hooks/useAuth'

type TopHeaderProps = {
  onToggleSidebar: () => void
}

// CLAUDE.md §6.2: cabecera superior fija y OSCURA en ambos temas (tokens
// --header-*, §6.1) — toggle de sidebar + logo + buscador a la izquierda,
// avatar con menú a la derecha (nombre + rol, Ajustes, Mis permisos, separador,
// Cerrar sesión — lista pensada para crecer).
export function TopHeader({ onToggleSidebar }: TopHeaderProps) {
  const { claims, logout } = useAuth()
  const navigate = useNavigate()
  const initials = (claims?.username ?? '?').slice(0, 2).toUpperCase()

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-header-border bg-header px-3 text-header-text">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          // CLAUDE.md §10/§11: área táctil ~44px sin agrandar el icono visual
          className="relative h-9 w-9 rounded-lg border border-header-border bg-header-surface text-header-muted hover:bg-header-surface hover:text-header-text after:absolute after:-inset-1 after:content-['']"
          onClick={onToggleSidebar}
          aria-label="Alternar sidebar"
        >
          <PanelLeft />
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-text-on-accent">
            <Database className="h-3.5 w-3.5" aria-hidden />
          </div>
          <span className="text-base font-bold tracking-tight">HomeDB</span>
        </div>
      </div>

      {/*
        PENDIENTE (CLAUDE.md §6.18): buscador global. GET /files/search ya existe
        (§5.4) pero no está integrado, y no hay búsqueda sobre otros módulos — de
        momento es solo la maqueta del diseño, sin atajo de teclado (no se promete
        un ⌘K que no existe).
      */}
      <button
        type="button"
        onClick={() => toast.info('Todavía no disponible')}
        className="ml-2 hidden max-w-[440px] flex-1 items-center gap-2 rounded-[9px] border border-header-border bg-header-surface px-3.5 py-2 text-left text-sm text-header-muted transition-colors hover:text-header-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:flex"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <span>Buscar en todo HomeDB</span>
      </button>

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 rounded-lg p-1 hover:bg-header-surface">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-accent-tint-bg text-xs font-medium text-accent-tint-text">
                {initials}
              </AvatarFallback>
            </Avatar>
            <ChevronDown className="h-4 w-4 text-header-muted" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[12rem]">
            <DropdownMenuLabel className="flex flex-col">
              <span>{claims?.username}</span>
              <span className="text-xs font-normal text-text-secondary">{claims?.role}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/account/settings')}>
              <Settings />
              Ajustes
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/account/permissions')}>
              <ShieldCheck />
              Mis permisos
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void logout()}>
              <LogOut />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

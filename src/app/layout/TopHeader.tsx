import { ChevronDown, Database, LogOut, PanelLeft } from 'lucide-react'

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

// CLAUDE.md §6.2: cabecera superior fija — toggle de sidebar + logo a la
// izquierda, avatar con menú a la derecha. El menú solo tiene "Cerrar sesión"
// por ahora; Ajustes y Mis permisos llegan en la Fase 3 (sin enlaces muertos).
export function TopHeader({ onToggleSidebar }: TopHeaderProps) {
  const { claims, logout } = useAuth()
  const initials = (claims?.username ?? '?').slice(0, 2).toUpperCase()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-bg px-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} aria-label="Alternar sidebar">
          <PanelLeft />
        </Button>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-accent" aria-hidden />
          <span className="text-sm font-semibold text-text-primary">HomeDB</span>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1 rounded-lg p-1 hover:bg-surface-alt">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-accent-tint-bg text-xs font-medium text-accent-tint-text">
              {initials}
            </AvatarFallback>
          </Avatar>
          <ChevronDown className="h-4 w-4 text-text-faint" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[12rem]">
          <DropdownMenuLabel className="flex flex-col">
            <span>{claims?.username}</span>
            <span className="text-xs font-normal text-text-secondary">{claims?.role}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void logout()}>
            <LogOut />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}

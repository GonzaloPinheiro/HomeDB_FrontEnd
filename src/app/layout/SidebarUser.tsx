import { Settings } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar'
import { useAuth } from '@/shared/hooks/useAuth'

// Bloque de usuario al pie del sidebar expandido (diseño de Inicio, §6.18):
// avatar + nombre + rol, con acceso directo a Ajustes. El menú completo
// (Mis permisos, Cerrar sesión) sigue en el avatar de la cabecera (§6.2).
export function SidebarUser() {
  const { claims } = useAuth()
  if (!claims) return null

  return (
    <div className="flex items-center gap-2.5 px-1">
      <Avatar className="h-[30px] w-[30px]">
        <AvatarFallback className="bg-accent-tint-bg text-xs font-semibold text-accent-tint-text">
          {claims.username.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 text-[13px] leading-tight text-text-primary">
        <div className="truncate">{claims.username}</div>
        <div className="text-[11px] text-text-secondary">
          {claims.role === 'Admin' ? 'Administrador' : 'Usuario'}
        </div>
      </div>
      <Link
        to="/account/settings"
        aria-label="Ajustes de cuenta"
        className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary"
      >
        <Settings className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  )
}

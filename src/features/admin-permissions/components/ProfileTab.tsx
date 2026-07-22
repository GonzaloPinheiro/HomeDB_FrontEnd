import { RoleBadge } from '@/shared/components/RoleBadge'
import { formatShortDate } from '@/shared/lib/formatDate'

import type { UserSummary } from '@/features/admin-users/types'

type ProfileTabProps = {
  user: UserSummary
}

/**
 * CLAUDE.md §5.4/§6.8: solo lectura — no existe ningún endpoint para que un
 * Admin edite el perfil de otro usuario, solo PATCH /users/me para el propio.
 * Los datos vienen del mismo UserSummary de la fila de la tabla (Fase 4a):
 * ya están frescos en el momento de abrir el modal, así que no hace falta una
 * query aparte solo para repintar lo mismo.
 */
export function ProfileTab({ user }: ProfileTabProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Usuario</p>
        <p className="mt-1 text-sm font-medium text-text-primary">{user.username}</p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Email</p>
        <p className="mt-1 text-sm text-text-primary">{user.email || '—'}</p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Rol</p>
        <div className="mt-1 flex gap-1">
          {user.roles.map((role) => (
            <RoleBadge key={role} role={role} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Creado</p>
        <p className="mt-1 text-sm text-text-primary">{formatShortDate(user.createdAt)}</p>
      </div>
      <p className="mt-2 border-t border-border-light pt-4 text-xs text-text-muted">
        Este perfil no se puede editar desde aquí: HomeDB solo permite que cada usuario cambie su
        propio nombre y email (Ajustes → Perfil). No existe un endpoint para que un administrador
        edite el perfil de otra persona.
      </p>
    </div>
  )
}

import { Badge } from '@/shared/components/ui/badge'

// Extraído de AdminUsersPage (Fase 4a) para reutilizarlo también en el Perfil
// del modal de detalle (Fase 4b) sin duplicar el mismo badge de dos colores.
export function RoleBadge({ role }: { role: string }) {
  return role === 'Admin' ? (
    <Badge className="bg-accent-tint-bg text-accent-tint-text shadow-none">Admin</Badge>
  ) : (
    <Badge variant="secondary">{role}</Badge>
  )
}

import { Lock, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { EmptyState } from '@/shared/components/EmptyState'
import { PageSkeleton } from '@/shared/components/PageSkeleton'
import { useAuth } from '@/shared/hooks/useAuth'
import { usePermissions } from '@/shared/hooks/usePermissions'
import type { AppModule } from '@/shared/types/api'

/** Protege un subárbol: exige sesión iniciada. Skeleton mientras se restaura (§6.10). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <PageSkeleton />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

/**
 * CLAUDE.md §7.3: guard de módulo. Sin acceso -> estado vacío informativo (§6.9),
 * sin botón (el usuario no puede activarse módulos a sí mismo) — no redirige.
 */
export function RequireModule({ module, children }: { module: AppModule; children: ReactNode }) {
  const { hasModule, isLoading } = usePermissions()
  if (isLoading) return <PageSkeleton />
  if (!hasModule(module)) {
    return (
      <EmptyState
        icon={Lock}
        title="Sin acceso a este módulo"
        description="Tu cuenta no tiene este módulo activado. Un administrador puede activarlo por ti."
      />
    )
  }
  return children
}

/**
 * CLAUDE.md §5.3: guard independiente de rol Admin — módulo activado no implica
 * rol Admin, por eso este guard existe por separado de RequireModule.
 * `fallback` permite usarlo alrededor de acciones sueltas (botones, items de
 * menú) ocultándolas con `null` en vez de mostrar el estado vacío de página.
 */
export function RequireAdmin({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { isAdmin } = usePermissions()
  if (!isAdmin) {
    if (fallback !== undefined) return fallback
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Solo para administradores"
        description="Esta acción requiere el rol de administrador."
      />
    )
  }
  return children
}

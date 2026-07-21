import { LayoutGrid, SearchX } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'

import { EmptyState } from '@/shared/components/EmptyState'
import { PageSkeleton } from '@/shared/components/PageSkeleton'
import { Button } from '@/shared/components/ui/button'
import { usePermissions } from '@/shared/hooks/usePermissions'
import type { AppModule } from '@/shared/types/api'

import { RequireAuth, RequireModule } from './guards'
import { AppShell } from './layout/AppShell'

// CLAUDE.md §3: lazy loading de páginas con React.lazy
const LoginPage = lazy(() => import('@/features/auth/components/LoginPage'))
const FilesPage = lazy(() => import('@/features/files/FilesPage'))
const MonitorPage = lazy(() => import('@/features/system-monitor/MonitorPage'))
const UsersPage = lazy(() => import('@/features/admin-users/UsersPage'))
const SystemLogsPage = lazy(() => import('@/features/admin-system-logs/SystemLogsPage'))
const AuditLogsPage = lazy(() => import('@/features/admin-audit-logs/AuditLogsPage'))

// Orden de preferencia al entrar a "/": primer módulo con acceso
const HOME_ORDER: Array<[AppModule, string]> = [
  ['Files', '/files'],
  ['SystemMonitor', '/monitor'],
  ['UserManagement', '/admin/users'],
  ['SystemLogs', '/admin/logs'],
  ['AuditLogs', '/admin/audit-logs'],
]

function HomeRedirect() {
  const { hasModule, isLoading } = usePermissions()
  if (isLoading) return <PageSkeleton />

  const target = HOME_ORDER.find(([module]) => hasModule(module))
  if (target) return <Navigate to={target[1]} replace />

  // CLAUDE.md §5.3/§6.9: usuario sin ningún módulo activo — informativo, sin
  // botón (no puede activarse módulos a sí mismo)
  return (
    <EmptyState
      icon={LayoutGrid}
      title="Sin módulos activados"
      description="Tu cuenta no tiene acceso a ningún módulo todavía. Un administrador debe activarlos por ti."
    />
  )
}

function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg">
      <EmptyState
        icon={SearchX}
        title="Página no encontrada"
        description="La dirección a la que intentas acceder no existe."
        action={
          <Button asChild variant="outline">
            <Link to="/">Ir al inicio</Link>
          </Button>
        }
      />
    </main>
  )
}

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <LoginPage />
          </Suspense>
        }
      />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<HomeRedirect />} />
        <Route
          path="/files"
          element={
            <RequireModule module="Files">
              <FilesPage />
            </RequireModule>
          }
        />
        <Route
          path="/monitor"
          element={
            <RequireModule module="SystemMonitor">
              <MonitorPage />
            </RequireModule>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireModule module="UserManagement">
              <UsersPage />
            </RequireModule>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <RequireModule module="SystemLogs">
              <SystemLogsPage />
            </RequireModule>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <RequireModule module="AuditLogs">
              <AuditLogsPage />
            </RequireModule>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

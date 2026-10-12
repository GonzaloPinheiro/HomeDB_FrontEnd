import { SearchX } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Link, Outlet } from 'react-router-dom'

import { EmptyState } from '@/shared/components/EmptyState'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { PageSkeleton } from '@/shared/components/PageSkeleton'
import { Button } from '@/shared/components/ui/button'
import { Toaster } from '@/shared/components/ui/sonner'
import { AuthProvider } from '@/shared/hooks/useAuth'

import { RequireAuth, RequireModule } from './guards'
import { AppShell } from './layout/AppShell'

// CLAUDE.md §3: lazy loading de páginas con React.lazy
const LoginPage = lazy(() => import('@/features/auth/components/LoginPage'))
const HomePage = lazy(() => import('@/features/home/HomePage'))
const FilesPage = lazy(() => import('@/features/files/FilesPage'))
const MonitorPage = lazy(() => import('@/features/system-monitor/MonitorPage'))
const UsersPage = lazy(() => import('@/features/admin-users/UsersPage'))
const SystemLogsPage = lazy(() => import('@/features/admin-system-logs/SystemLogsPage'))
const AuditLogsPage = lazy(() => import('@/features/admin-audit-logs/AuditLogsPage'))
const AccountSettingsPage = lazy(() => import('@/features/account/AccountSettingsPage'))
const MyPermissionsPage = lazy(() => import('@/features/account/MyPermissionsPage'))

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

// Capa de providers dependientes del router (AuthProvider usa useNavigate)
function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster />
    </AuthProvider>
  )
}

// Data router (createBrowserRouter): necesario para useBlocker — el aviso de
// cambios sin guardar (§11) al salir de una página no existe en <BrowserRouter>
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/login',
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <LoginPage />
          </Suspense>
        ),
      },
      {
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          // Inicio (§6.18): pantalla de entrada, sin guard de módulo — cada tarjeta
          // resuelve por su cuenta qué datos puede mostrar
          {
            path: '/',
            element: (
              <ErrorBoundary sectionLabel="el Inicio">
                <HomePage />
              </ErrorBoundary>
            ),
          },
          {
            path: '/files',
            element: (
              <RequireModule module="Files">
                <ErrorBoundary sectionLabel="el explorador de archivos">
                  <FilesPage />
                </ErrorBoundary>
              </RequireModule>
            ),
          },
          {
            path: '/monitor',
            element: (
              <RequireModule module="SystemMonitor">
                <ErrorBoundary sectionLabel="el Monitor del sistema">
                  <MonitorPage />
                </ErrorBoundary>
              </RequireModule>
            ),
          },
          {
            path: '/admin/users',
            element: (
              <RequireModule module="UserManagement">
                <ErrorBoundary sectionLabel="Usuarios">
                  <UsersPage />
                </ErrorBoundary>
              </RequireModule>
            ),
          },
          {
            path: '/admin/logs',
            element: (
              <RequireModule module="SystemLogs">
                <ErrorBoundary sectionLabel="Registros">
                  <SystemLogsPage />
                </ErrorBoundary>
              </RequireModule>
            ),
          },
          {
            path: '/admin/audit-logs',
            element: (
              <RequireModule module="AuditLogs">
                <ErrorBoundary sectionLabel="Auditoría">
                  <AuditLogsPage />
                </ErrorBoundary>
              </RequireModule>
            ),
          },
          // Cuenta propia: solo requiere sesión, sin guard de módulo
          {
            path: '/account/settings',
            element: (
              <ErrorBoundary sectionLabel="Ajustes de cuenta">
                <AccountSettingsPage />
              </ErrorBoundary>
            ),
          },
          {
            path: '/account/permissions',
            element: (
              <ErrorBoundary sectionLabel="Mis permisos">
                <MyPermissionsPage />
              </ErrorBoundary>
            ),
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

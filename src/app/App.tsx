import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'

import { ErrorBoundary } from '@/shared/components/ErrorBoundary'

import { router } from './router'

const queryClient = new QueryClient()

// CLAUDE.md §4: providers + router raíz. AuthProvider vive dentro del router
// (RootLayout en router.tsx) porque usa useNavigate (§5.2).
// CLAUDE.md §6.15 (Fase 7): error boundary de app entera — última red de
// seguridad si algo revienta fuera de cualquier sección (ej. el propio
// AuthProvider). Las secciones principales llevan además su propio boundary
// más específico en router.tsx, que se activa primero.
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </QueryClientProvider>
  )
}

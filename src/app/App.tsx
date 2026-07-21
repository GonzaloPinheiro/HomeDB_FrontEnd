import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'

import { Toaster } from '@/shared/components/ui/sonner'
import { AuthProvider } from '@/shared/hooks/useAuth'

import { AppRouter } from './router'

const queryClient = new QueryClient()

// CLAUDE.md §4: providers (QueryClient, AuthProvider, Router) + layout raíz.
// AuthProvider va dentro de BrowserRouter porque usa useNavigate (§5.2: la
// navegación a /login tras expirar la sesión va por el router).
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

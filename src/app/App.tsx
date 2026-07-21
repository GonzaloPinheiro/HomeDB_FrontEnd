import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'

const queryClient = new QueryClient()

// Fase 0: solo providers + placeholder para verificar que Tailwind y los tokens
// de tema (§6.1) funcionan end-to-end. AuthProvider, router.tsx con rutas reales
// y el AppShell llegan en la Fase 1.
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-bg px-4">
          <h1 className="text-2xl font-semibold text-text-primary">HomeDB — en construcción</h1>
          <p className="text-sm text-text-secondary">
            Fase 0: andamiaje verificado. Las pantallas llegan en las siguientes fases.
          </p>
        </main>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'

import { router } from './router'

const queryClient = new QueryClient()

// CLAUDE.md §4: providers + router raíz. AuthProvider vive dentro del router
// (RootLayout en router.tsx) porque usa useNavigate (§5.2).
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

import { Suspense, useState } from 'react'
import { Outlet } from 'react-router-dom'

import { UploadModal } from '@/features/files/components/UploadModal'
import { UploadQueueProvider } from '@/features/files/uploadQueue/UploadQueueContext'
import { PageSkeleton } from '@/shared/components/PageSkeleton'

import { Sidebar } from './Sidebar'
import { TopHeader } from './TopHeader'
import { UploadTray } from './UploadTray'

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

// CLAUDE.md §6.2: cabecera fija arriba, sidebar debajo, contenido a la derecha.
// CLAUDE.md §6.5/§7.4: UploadQueueProvider se monta aquí (no dentro de la
// página de Archivos) para que una subida siga corriendo al navegar a otra
// sección — AppShell no se desmonta entre rutas protegidas. UploadModal y
// UploadTray son globales por el mismo motivo: leen del contexto, no de props.
export function AppShell() {
  // El estado colapsado persiste en el dispositivo para sobrevivir a un refresco
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
  )

  const toggleSidebar = () => {
    setCollapsed((value) => {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(!value))
      return !value
    })
  }

  return (
    <UploadQueueProvider>
      <div className="flex h-screen flex-col bg-bg">
        <TopHeader onToggleSidebar={toggleSidebar} />
        <div className="flex min-h-0 flex-1">
          <Sidebar collapsed={collapsed} />
          <main className="min-w-0 flex-1 overflow-y-auto">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
      <UploadTray />
      <UploadModal />
    </UploadQueueProvider>
  )
}

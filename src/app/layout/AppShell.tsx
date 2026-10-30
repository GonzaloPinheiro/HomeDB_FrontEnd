import { Suspense, lazy, useState } from 'react'
import { Outlet } from 'react-router-dom'

import { UploadModal } from '@/features/files/components/UploadModal'
import { UploadQueueProvider } from '@/features/files/uploadQueue/UploadQueueContext'
import { PageSkeleton } from '@/shared/components/PageSkeleton'
import { usePreventBrowserFileOpen } from '@/shared/hooks/usePreventBrowserFileOpen'

import { useSettingsModal } from '../settings/useSettingsModal'

import { Sidebar } from './Sidebar'
import { TopHeader } from './TopHeader'
import { UploadTray } from './UploadTray'

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

// Carga perezosa: el código del modal de ajustes solo se descarga la primera vez que se abre.
const SettingsModal = lazy(() => import('../settings/SettingsModal'))

// CLAUDE.md §6.20: el modal de ajustes se abre desde cualquier pantalla (menú del avatar,
// bloque de usuario del sidebar o un enlace `?settings=…`), así que vive en el shell.
function SettingsHost() {
  const { section } = useSettingsModal()
  if (section === null) return null
  return (
    <Suspense fallback={null}>
      <SettingsModal />
    </Suspense>
  )
}

// CLAUDE.md §6.2: cabecera fija arriba, sidebar debajo, contenido a la derecha.
// CLAUDE.md §6.5/§7.4: UploadQueueProvider se monta aquí (no dentro de la
// página de Archivos) para que una subida siga corriendo al navegar a otra
// sección — AppShell no se desmonta entre rutas protegidas. UploadModal y
// UploadTray son globales por el mismo motivo: leen del contexto, no de props.
export function AppShell() {
  // CLAUDE.md §11: en cualquier pantalla, soltar un archivo fuera de una zona de
  // subida no debe abrirlo en el navegador y sacar al usuario de la app.
  usePreventBrowserFileOpen()

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
        {/* §6.18: "lienzo hundido" — degradado radial sobre el que flotan sidebar y tarjetas */}
        <div className="flex min-h-0 flex-1 bg-[radial-gradient(1100px_520px_at_78%_-12%,var(--card)_0%,var(--surface)_58%,var(--surface-alt)_100%)]">
          <Sidebar collapsed={collapsed} />
          <main className="min-w-0 flex-1 overflow-y-auto shadow-[inset_6px_0_14px_-12px_color-mix(in_srgb,var(--text-primary)_55%,transparent)]">
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
      <UploadTray />
      <UploadModal />
      <SettingsHost />
    </UploadQueueProvider>
  )
}

import { Suspense, useState } from 'react'
import { Outlet } from 'react-router-dom'

import { PageSkeleton } from '@/shared/components/PageSkeleton'

import { Sidebar } from './Sidebar'
import { TopHeader } from './TopHeader'

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

// CLAUDE.md §6.2: cabecera fija arriba, sidebar debajo, contenido a la derecha.
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
  )
}

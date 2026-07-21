import { Activity, ClipboardList, Folder, ScrollText, Users, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { Skeleton } from '@/shared/components/ui/skeleton'
import { usePermissions } from '@/shared/hooks/usePermissions'

import { StorageWidget } from './StorageWidget'
import { cn } from '@/shared/lib/utils'
import type { AppModule } from '@/shared/types/api'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  module: AppModule
}

// CLAUDE.md §6.2: módulos personales arriba, sección "Administración" aparte.
// Roles queda fuera del sidebar mientras está en pausa de diseño (§6.6b).
// Expenses/Investments/RemoteScripts son módulos fantasma (§5.3): sin nav.
const PERSONAL_ITEMS: NavItem[] = [
  { to: '/files', label: 'Archivos', icon: Folder, module: 'Files' },
  { to: '/monitor', label: 'Monitor', icon: Activity, module: 'SystemMonitor' },
]

const ADMIN_ITEMS: NavItem[] = [
  { to: '/admin/users', label: 'Usuarios', icon: Users, module: 'UserManagement' },
  { to: '/admin/logs', label: 'Registros', icon: ScrollText, module: 'SystemLogs' },
  { to: '/admin/audit-logs', label: 'Auditoría', icon: ClipboardList, module: 'AuditLogs' },
]

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-accent-tint-bg font-medium text-accent-tint-text'
            : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  )
}

// CLAUDE.md §6.2: sidebar expandida (~190px) o rail de iconos (~56px), nunca
// oculta del todo. Cada entrada solo aparece si hasModule() lo confirma —
// nunca una lista estática.
export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const { hasModule, isLoading } = usePermissions()

  const personal = PERSONAL_ITEMS.filter((item) => hasModule(item.module))
  const admin = ADMIN_ITEMS.filter((item) => hasModule(item.module))

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-border bg-surface p-2 transition-[width] duration-200',
        collapsed ? 'w-14' : 'w-[190px]',
      )}
    >
      {isLoading ? (
        <div className="flex flex-col gap-2 p-1">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : (
        <nav className="flex flex-1 flex-col gap-1">
          {personal.map((item) => (
            <SidebarLink key={item.to} item={item} collapsed={collapsed} />
          ))}

          {admin.length > 0 && (
            <>
              {!collapsed ? (
                <p className="mt-4 px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">
                  Administración
                </p>
              ) : (
                <div className="my-3 h-px bg-border-light" />
              )}
              {admin.map((item) => (
                <SidebarLink key={item.to} item={item} collapsed={collapsed} />
              ))}
            </>
          )}
        </nav>
      )}

      {/* CLAUDE.md §6.12/§6.2: widget de almacenamiento solo con el sidebar
          expandido — se oculta al contraer a rail, igual que las etiquetas */}
      {!collapsed && <StorageWidget />}
    </aside>
  )
}

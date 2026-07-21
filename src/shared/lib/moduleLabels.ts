import {
  Activity,
  ClipboardList,
  Folder,
  ScrollText,
  Shield,
  TerminalSquare,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import type { AppModule } from '@/shared/types/api'

// ÚNICA fuente de etiquetas e iconos por módulo (español). La consumen "Mis
// permisos" (Fase 3) y el editor de permisos de Usuarios en Admin (Fase 4) —
// no duplicar este mapa en ninguna feature.
export const MODULE_LABELS: Record<AppModule, { label: string; icon: LucideIcon }> = {
  Files: { label: 'Archivos', icon: Folder },
  Expenses: { label: 'Gastos', icon: Wallet },
  Investments: { label: 'Inversiones', icon: TrendingUp },
  SystemMonitor: { label: 'Monitor', icon: Activity },
  UserManagement: { label: 'Gestión de usuarios', icon: Users },
  RoleManagement: { label: 'Gestión de roles', icon: Shield },
  SystemLogs: { label: 'Logs de sistema', icon: ScrollText },
  AuditLogs: { label: 'Auditoría', icon: ClipboardList },
  RemoteScripts: { label: 'Scripts remotos', icon: TerminalSquare },
}

export const ALL_MODULES = Object.keys(MODULE_LABELS) as AppModule[]

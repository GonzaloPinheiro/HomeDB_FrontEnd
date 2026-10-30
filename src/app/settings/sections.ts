import {
  Bell,
  HardDrive,
  type LucideIcon,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  Lock,
} from 'lucide-react'

// CLAUDE.md §6.20: secciones del modal de ajustes. Única fuente de la lista: la
// consumen la navegación, el contenido y el estado en la URL. Para añadir una
// sección nueva: una entrada aquí + su componente en `SettingsModal.tsx`.

export type SettingsSection =
  'profile' | 'security' | 'general' | 'appearance' | 'notifications' | 'storage' | 'permissions'

export type SettingsGroupId = 'account' | 'preferences' | 'space'

export const SETTINGS_GROUPS: ReadonlyArray<{ id: SettingsGroupId; label: string }> = [
  { id: 'account', label: 'Cuenta' },
  { id: 'preferences', label: 'Preferencias' },
  { id: 'space', label: 'Tu espacio' },
]

export type SettingsSectionDef = {
  id: SettingsSection
  label: string
  icon: LucideIcon
  group: SettingsGroupId
}

export const SETTINGS_SECTIONS: ReadonlyArray<SettingsSectionDef> = [
  { id: 'profile', label: 'Perfil', icon: UserRound, group: 'account' },
  { id: 'security', label: 'Seguridad', icon: Lock, group: 'account' },
  { id: 'general', label: 'General', icon: SlidersHorizontal, group: 'preferences' },
  { id: 'appearance', label: 'Apariencia', icon: Palette, group: 'preferences' },
  { id: 'notifications', label: 'Notificaciones', icon: Bell, group: 'preferences' },
  { id: 'storage', label: 'Almacenamiento', icon: HardDrive, group: 'space' },
  { id: 'permissions', label: 'Permisos', icon: ShieldCheck, group: 'space' },
]

export const DEFAULT_SETTINGS_SECTION: SettingsSection = 'profile'

const SECTION_IDS: ReadonlySet<string> = new Set(SETTINGS_SECTIONS.map((section) => section.id))

/** `?settings=security` -> 'security'. Cualquier valor que no sea una sección conocida es "cerrado". */
export function parseSettingsSection(raw: string | null): SettingsSection | null {
  return raw !== null && SECTION_IDS.has(raw) ? (raw as SettingsSection) : null
}

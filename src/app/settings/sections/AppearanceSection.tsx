import { Monitor, Moon, Sun } from 'lucide-react'
import { useState } from 'react'

import { notAvailableYet } from '@/shared/lib/notAvailableYet'
import { getThemePreference, setThemePreference, type ThemePreference } from '@/shared/lib/theme'
import { cn } from '@/shared/lib/utils'

import { ComingSoonTag, SettingsCard, SettingsPanel, SettingsRow } from '../SettingsLayout'

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'auto', label: 'Automático', icon: Monitor },
]

const OPTION_BASE = 'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors'
const OPTION_ON = 'border-accent bg-accent-tint-bg font-medium text-accent-tint-text'
const OPTION_OFF = 'border-border text-text-secondary hover:bg-surface-alt hover:text-text-primary'

export function AppearanceSection() {
  // Tema (§6.1): se aplica al instante y vive solo en este dispositivo
  const [theme, setTheme] = useState<ThemePreference>(() => getThemePreference())
  const selectTheme = (preference: ThemePreference) => {
    setThemePreference(preference)
    setTheme(preference)
  }

  return (
    <SettingsPanel title="Apariencia" description="Cómo se ve la interfaz en este dispositivo.">
      <SettingsCard title="Tema">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tema de la interfaz">
          {THEME_OPTIONS.map(({ value, label, icon: OptionIcon }) => (
            <button
              key={value}
              type="button"
              onClick={() => selectTheme(value)}
              aria-pressed={theme === value}
              className={cn(OPTION_BASE, theme === value ? OPTION_ON : OPTION_OFF)}
            >
              <OptionIcon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-text-muted">
          Automático sigue la preferencia del sistema. Se guarda solo en este dispositivo.
        </p>
      </SettingsCard>

      {/* PENDIENTE (CLAUDE.md §6.20): la interfaz solo tiene una densidad */}
      <SettingsCard>
        <SettingsRow
          title="Densidad"
          description="Cuánto espacio ocupan las listas y las tablas."
          tag={<ComingSoonTag />}
        >
          <div className="flex gap-2" role="group" aria-label="Densidad de la interfaz">
            <button type="button" aria-pressed className={cn(OPTION_BASE, OPTION_ON)}>
              Cómoda
            </button>
            <button
              type="button"
              aria-pressed={false}
              onClick={() => notAvailableYet()}
              className={cn(OPTION_BASE, OPTION_OFF)}
            >
              Compacta
            </button>
          </div>
        </SettingsRow>
      </SettingsCard>
    </SettingsPanel>
  )
}

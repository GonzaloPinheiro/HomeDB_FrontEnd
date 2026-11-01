import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, CirclePause, ExternalLink, Pause, Play, ShieldCheck, ShieldOff } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { FloatCard } from '@/shared/components/FloatCard'
import { Modal } from '@/shared/components/Modal'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Switch } from '@/shared/components/ui/switch'
import { notAvailableYet } from '@/shared/lib/notAvailableYet'
import { cn } from '@/shared/lib/utils'

import { adBlockerKeys } from '../api'
import {
  formatClock,
  formatCountdown,
  getProtectionMode,
  msUntil,
  parsePauseMinutes,
  type ProtectionMode,
} from '../presentation'
import type { AdBlockerStatus } from '../types'
import { useNow } from '../useNow'

// Duración en minutos y etiqueta de los atajos del menú de pausa.
const PAUSE_PRESETS = [
  { minutes: 5, label: '5 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 h' },
  { minutes: 480, label: '8 h' },
] as const

const SETTINGS_TOGGLES = [
  { key: 'safeBrowsingEnabled', label: 'Navegación segura', description: 'Bloquea webs conocidas de malware y phishing' },
  { key: 'parentalControlEnabled', label: 'Control parental', description: 'Bloquea contenido para adultos en toda la red' },
  { key: 'safeSearchEnabled', label: 'Búsqueda segura', description: 'Fuerza el modo seguro en buscadores y YouTube' },
] as const

// Color con propósito (§6.7): verde = filtrando, ámbar = pausa temporal, rojo = sin filtrar.
const MODE_STYLE: Record<ProtectionMode, { icon: typeof ShieldCheck; tint: string; label: string }> = {
  protected: { icon: ShieldCheck, tint: 'bg-positive-bg text-positive-text', label: 'Protegido' },
  paused: { icon: CirclePause, tint: 'bg-warning-bg text-warning-text', label: 'Pausado' },
  disabled: { icon: ShieldOff, tint: 'bg-critical-bg text-critical-text', label: 'Desactivado' },
}

function describeMode(mode: ProtectionMode, remaining: string): string {
  if (mode === 'protected') return 'Filtrando las consultas DNS de toda la red'
  if (mode === 'paused') return `Se reactivará sola dentro de ${remaining}`
  return 'La red no está filtrando anuncios ni rastreadores'
}

// CLAUDE.md §6.21: estado de la protección y controles. Maqueta: los menús se abren y
// validan, pero pausar, reactivar y los interruptores solo avisan con `notAvailableYet`.
// PENDIENTE (CLAUDE.md §6.21): conectar a `POST /adblocker/protection` (con `durationSeconds`
// opcional) y a los tres endpoints de navegación segura / control parental / búsqueda segura.
export function ProtectionCard({ status }: { status: AdBlockerStatus }) {
  const queryClient = useQueryClient()
  const [pauseOpen, setPauseOpen] = useState(false)
  const [confirmOffOpen, setConfirmOffOpen] = useState(false)
  const [customMinutes, setCustomMinutes] = useState('45')
  const [customError, setCustomError] = useState<string | null>(null)

  // Solo hay reloj mientras haya una pausa en curso
  const ticking = status.pausedUntil !== null
  const now = useNow(ticking)
  const mode = getProtectionMode(status, now)
  const remaining = status.pausedUntil !== null ? formatCountdown(msUntil(status.pausedUntil, now)) : ''
  const style = MODE_STYLE[mode]
  const Icon = style.icon

  // Al acabar la pausa no se da por hecho que el servidor ya reactivó la protección (el reloj
  // del navegador y el de la Pi no tienen por qué coincidir): se vuelve a preguntar.
  const previousMode = useRef(mode)
  useEffect(() => {
    if (previousMode.current === 'paused' && mode !== 'paused') {
      void queryClient.invalidateQueries({ queryKey: adBlockerKeys.status() })
    }
    previousMode.current = mode
  }, [mode, queryClient])

  const pickPreset = () => {
    setPauseOpen(false)
    notAvailableYet()
  }

  const pickCustom = () => {
    const result = parsePauseMinutes(customMinutes)
    if (!result.ok) {
      setCustomError(result.message)
      return
    }
    setCustomError(null)
    setPauseOpen(false)
    notAvailableYet()
  }

  const askDisableUntilReactivated = () => {
    setPauseOpen(false)
    setConfirmOffOpen(true)
  }

  const confirmDisable = () => {
    setConfirmOffOpen(false)
    notAvailableYet()
  }

  return (
    <FloatCard className="flex flex-col gap-[18px] p-5 sm:px-[22px] sm:py-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className={cn('flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px]', style.tint)}>
          <Icon className="h-[26px] w-[26px]" aria-hidden />
        </div>

        <div className="min-w-[200px] flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={cn('inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-sm font-bold', style.tint)}
              // Región viva: el cambio de estado se anuncia al lector de pantalla
              role="status"
            >
              <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
              {mode === 'paused' && status.pausedUntil !== null
                ? `Pausado hasta ${formatClock(status.pausedUntil)}`
                : style.label}
            </span>
            {mode === 'paused' && (
              <span className="font-mono text-[13px] text-warning-text">quedan {remaining}</span>
            )}
          </div>
          <p className="mt-1.5 text-sm text-text-secondary">{describeMode(mode, remaining)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode === 'protected' ? (
            <Popover open={pauseOpen} onOpenChange={setPauseOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="gap-2">
                  <Pause aria-hidden />
                  Pausar protección
                  <ChevronDown className="text-text-muted" aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="flex w-64 flex-col gap-2.5 rounded-xl bg-card p-3 shadow-float">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Pausar durante</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {PAUSE_PRESETS.map((preset) => (
                    <Button key={preset.minutes} type="button" variant="secondary" size="sm" onClick={pickPreset}>
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={1}
                    max={1440}
                    inputMode="numeric"
                    value={customMinutes}
                    onChange={(event) => {
                      setCustomMinutes(event.target.value)
                      setCustomError(null)
                    }}
                    aria-label="Minutos de pausa"
                    aria-invalid={customError !== null}
                    className="h-8 w-[70px] px-2.5"
                  />
                  <span className="text-[13px] text-text-secondary">min</span>
                  <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={pickCustom}>
                    Personalizado
                  </Button>
                </div>
                {customError !== null && <p className="text-xs text-critical-text">{customError}</p>}
                <div className="h-px bg-border-light" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start text-critical-text hover:bg-critical-bg hover:text-critical-text"
                  onClick={askDisableUntilReactivated}
                >
                  Hasta reactivar…
                </Button>
              </PopoverContent>
            </Popover>
          ) : (
            <Button type="button" onClick={notAvailableYet} className="gap-2">
              <Play className="fill-current" aria-hidden />
              Reactivar
            </Button>
          )}

          {status.panelUrl !== null && (
            <Button asChild variant="outline">
              <a
                href={status.panelUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Tiene su propio inicio de sesión. Solo se abre desde la red local."
              >
                Abrir panel de AdGuard
                <ExternalLink className="text-text-muted" aria-hidden />
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {SETTINGS_TOGGLES.map((toggle) => (
          <ToggleRow key={toggle.key} label={toggle.label} description={toggle.description}>
            <Switch
              checked={status[toggle.key]}
              onCheckedChange={notAvailableYet}
              aria-label={toggle.label}
            />
          </ToggleRow>
        ))}
      </div>

      <Modal
        open={confirmOffOpen}
        onOpenChange={setConfirmOffOpen}
        title="¿Desactivar hasta que la reactives?"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setConfirmOffOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDisable}>
              Desactivar protección
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-text-secondary">
          La red dejará de filtrar anuncios, rastreadores y malware hasta que pulses Reactivar. No se reactivará sola.
        </p>
      </Modal>
    </FloatCard>
  )
}

function ToggleRow({ label, description, children }: { label: string; description: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[10px] border border-border-light bg-surface p-3.5">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-text-primary">{label}</div>
        <div className="mt-0.5 text-xs leading-snug text-text-secondary">{description}</div>
      </div>
      {children}
    </div>
  )
}

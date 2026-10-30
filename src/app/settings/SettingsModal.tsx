import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { useBlocker } from 'react-router-dom'

import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { Modal } from '@/shared/components/Modal'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { cn } from '@/shared/lib/utils'

import { SettingsDirtyProvider } from './dirty'
import {
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  parseSettingsSection,
  type SettingsSection,
} from './sections'
import { AppearanceSection } from './sections/AppearanceSection'
import { GeneralSection } from './sections/GeneralSection'
import { NotificationsSection } from './sections/NotificationsSection'
import { PermissionsSection } from './sections/PermissionsSection'
import { ProfileSection } from './sections/ProfileSection'
import { SecuritySection } from './sections/SecuritySection'
import { StorageSection } from './sections/StorageSection'
import { useSettingsModal } from './useSettingsModal'

const SECTION_COMPONENTS: Record<SettingsSection, ComponentType> = {
  profile: ProfileSection,
  security: SecuritySection,
  general: GeneralSection,
  appearance: AppearanceSection,
  notifications: NotificationsSection,
  storage: StorageSection,
  permissions: PermissionsSection,
}

// CLAUDE.md §6.20: modal de ajustes (perfil y preferencias de la cuenta), centrado, con la
// lista de secciones a la izquierda y su contenido a la derecha. Es una excepción a las
// dos tallas de §6.14 (como el visor de §6.3c): no es una confirmación ni un formulario
// suelto, sino una pantalla de ajustes con navegación propia.
export default function SettingsModal() {
  const { section, select, close } = useSettingsModal()

  // Las secciones visitadas siguen montadas (ocultas), así que cambiar de sección no pierde
  // lo escrito en un formulario sin guardar. Las que no se han visitado ni se montan: no
  // disparan sus peticiones hasta que hacen falta.
  const [visited, setVisited] = useState<ReadonlySet<SettingsSection>>(
    () => new Set(section ? [section] : []),
  )
  const [dirty, setDirtySections] = useState<ReadonlySet<SettingsSection>>(new Set())
  const [confirmingClose, setConfirmingClose] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // El bloqueador de navegación necesita leer el valor MÁS reciente, no el de un render antiguo.
  const hasChangesRef = useRef(false)
  useEffect(() => {
    hasChangesRef.current = dirty.size > 0
  }, [dirty])

  const setDirty = useCallback((target: SettingsSection, isDirty: boolean) => {
    setDirtySections((current) => {
      if (current.has(target) === isDirty) return current
      const next = new Set(current)
      if (isDirty) next.add(target)
      else next.delete(target)
      return next
    })
  }, [])

  // §11: confirmar antes de descartar cambios. Cubre también «atrás» del navegador (salir
  // del modal por la URL), que no pasa por el botón de cerrar.
  const blocker = useBlocker(
    ({ nextLocation }) =>
      hasChangesRef.current &&
      parseSettingsSection(new URLSearchParams(nextLocation.search).get('settings')) === null,
  )

  useEffect(() => {
    if (dirty.size === 0) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const requestClose = () => {
    if (hasChangesRef.current) setConfirmingClose(true)
    else close()
  }

  const discardAndClose = () => {
    hasChangesRef.current = false
    setConfirmingClose(false)
    if (blocker.state === 'blocked') blocker.proceed()
    else close()
  }

  const keepEditing = () => {
    setConfirmingClose(false)
    if (blocker.state === 'blocked') blocker.reset()
  }

  const goTo = (target: SettingsSection) => {
    setVisited((current) => (current.has(target) ? current : new Set(current).add(target)))
    select(target)
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && requestClose()}>
        <DialogContent
          ref={contentRef}
          // Foco inicial en el propio diálogo (§11, Radix lo atrapa y devuelve): por defecto iría
          // al primer botón de la lista, con un anillo de foco que parece una selección.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            contentRef.current?.focus()
          }}
          className="flex h-[min(640px,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-[900px] flex-col gap-0 overflow-hidden rounded-2xl bg-card p-0 focus:outline-none sm:rounded-2xl md:flex-row"
        >
          <DialogDescription className="sr-only">
            Ajustes de tu cuenta y de la aplicación
          </DialogDescription>

          {/* Navegación: lista vertical agrupada en escritorio; fila desplazable en móvil
              (a la derecha, hueco para el botón de cerrar del diálogo). */}
          <nav
            aria-label="Secciones de ajustes"
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface p-2 pr-12 md:w-[232px] md:flex-col md:gap-0 md:overflow-y-auto md:border-b-0 md:border-r md:p-3"
          >
            <DialogTitle className="sr-only px-2.5 pb-3 pt-1 text-lg md:not-sr-only">
              Ajustes
            </DialogTitle>
            {SETTINGS_GROUPS.map((group) => (
              <div key={group.id} className="flex gap-1 md:flex-col md:gap-0.5 md:pb-3">
                <p className="hidden px-2.5 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wider text-text-muted md:block">
                  {group.label}
                </p>
                {SETTINGS_SECTIONS.filter((item) => item.group === group.id).map(
                  ({ id, label, icon: SectionIcon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => goTo(id)}
                      aria-current={section === id ? 'page' : undefined}
                      className={cn(
                        'flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        section === id
                          ? 'bg-accent-tint-bg font-medium text-accent-tint-text'
                          : 'text-text-secondary hover:bg-row-hover hover:text-text-primary',
                      )}
                    >
                      <SectionIcon className="h-4 w-4 shrink-0" aria-hidden />
                      {label}
                      {dirty.has(id) ? (
                        <span
                          className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                          role="img"
                          aria-label="Cambios sin guardar"
                        />
                      ) : null}
                    </button>
                  ),
                )}
              </div>
            ))}
          </nav>

          {/* Contenido: el fallo de una sección no tira el modal ni la navegación (§6.15). */}
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5 md:p-7">
            <ErrorBoundary sectionLabel="los ajustes">
              <SettingsDirtyProvider value={{ setDirty }}>
                {SETTINGS_SECTIONS.map(({ id }) => {
                  if (id !== section && !visited.has(id)) return null
                  const SectionComponent = SECTION_COMPONENTS[id]
                  return (
                    <div key={id} hidden={id !== section}>
                      <SectionComponent />
                    </div>
                  )
                })}
              </SettingsDirtyProvider>
            </ErrorBoundary>
          </div>
        </DialogContent>
      </Dialog>

      {/* §11: confirmación antes de descartar cambios sin guardar */}
      <Modal
        open={confirmingClose || blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open) keepEditing()
        }}
        title="Cambios sin guardar"
        size="small"
        footer={
          <>
            <Button variant="outline" onClick={keepEditing}>
              Seguir editando
            </Button>
            <Button variant="destructive" onClick={discardAndClose}>
              Descartar cambios
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          Tienes cambios sin guardar en los ajustes. Si sales ahora, se perderán.
        </p>
      </Modal>
    </>
  )
}

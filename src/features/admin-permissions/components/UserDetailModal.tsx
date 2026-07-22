import { Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'

import { Modal } from '@/shared/components/Modal'
import { Button } from '@/shared/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import type { UserSummary } from '@/shared/types/user'

import { LimitsTab } from './LimitsTab'
import { PermissionsTab } from './PermissionsTab'
import { ProfileTab } from './ProfileTab'
import type { TabHandle, TabStatus } from './tabTypes'

type UserDetailModalProps = {
  open: boolean
  onClose: () => void
  user: UserSummary
}

type TabKey = 'profile' | 'permissions' | 'limits'

const IDLE_STATUS: TabStatus = { dirty: false, pending: false }

/**
 * CLAUDE.md §6.8/§6.14: modal grande de detalle de usuario — Perfil (solo
 * lectura), Permisos y Límites. Un único botón "Guardar" en el pie que actúa
 * SOLO sobre la pestaña activa (cada una habla con un endpoint distinto, ver
 * fase 4b §4) — nunca un guardado global de las tres a la vez.
 *
 * Radix Tabs desmonta el contenido de la pestaña inactiva por defecto (sin
 * `forceMount`) — se aprovecha esto para "descartar" cambios sin guardar al
 * confirmar el aviso de §11: como el cambio de pestaña/cierre solo se aplica
 * DESPUÉS de confirmar, el desmontaje natural de la pestaña saliente ya deja
 * su formulario limpio la próxima vez que se monte (no hace falta un reset
 * explícito).
 */
export function UserDetailModal({ open, onClose, user }: UserDetailModalProps) {
  const targetIsAdmin = user.roles.includes('Admin')

  const [activeTab, setActiveTab] = useState<TabKey>('profile')
  // Pestaña que se quiere abrir mientras la actual tiene cambios sin guardar
  const [pendingTab, setPendingTab] = useState<TabKey | null>(null)
  // Se intentó cerrar el modal (Escape, overlay, X o "Cerrar") con cambios sin guardar
  const [pendingClose, setPendingClose] = useState(false)

  const [permissionsStatus, setPermissionsStatus] = useState<TabStatus>(IDLE_STATUS)
  const [limitsStatus, setLimitsStatus] = useState<TabStatus>(IDLE_STATUS)

  const permissionsRef = useRef<TabHandle>(null)
  const limitsRef = useRef<TabHandle>(null)

  const status =
    activeTab === 'permissions' ? permissionsStatus : activeTab === 'limits' ? limitsStatus : IDLE_STATUS
  const activeRef = activeTab === 'permissions' ? permissionsRef : activeTab === 'limits' ? limitsRef : null

  const requestTabChange = (next: TabKey) => {
    if (next === activeTab) return
    if (status.dirty) {
      setPendingTab(next)
      return
    }
    setActiveTab(next)
  }

  const requestClose = () => {
    if (status.dirty) {
      setPendingClose(true)
      return
    }
    onClose()
  }

  const confirmDiscard = () => {
    if (pendingTab) {
      setActiveTab(pendingTab)
      setPendingTab(null)
    }
    if (pendingClose) {
      setPendingClose(false)
      onClose()
    }
  }

  const cancelDiscard = () => {
    setPendingTab(null)
    setPendingClose(false)
  }

  // Perfil no tiene nada que guardar; Permisos tampoco cuando el objetivo es
  // Admin (el grid ni se pinta, §5.3) — sin botón Guardar en esos casos (§6.8)
  const showSaveButton = activeTab !== 'profile' && !(activeTab === 'permissions' && targetIsAdmin)

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(value) => {
          if (!value) requestClose()
        }}
        title={`Usuario: ${user.username}`}
        size="large"
        footer={
          <>
            <Button variant="outline" onClick={requestClose}>
              Cerrar
            </Button>
            {showSaveButton ? (
              <Button onClick={() => activeRef?.current?.submit()} disabled={!status.dirty || status.pending}>
                {status.pending ? <Loader2 className="animate-spin" /> : null}
                Guardar
              </Button>
            ) : null}
          </>
        }
      >
        <Tabs value={activeTab} onValueChange={(value) => requestTabChange(value as TabKey)}>
          <TabsList>
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="permissions">Permisos</TabsTrigger>
            <TabsTrigger value="limits">Límites</TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
            <ProfileTab user={user} />
          </TabsContent>
          <TabsContent value="permissions">
            <PermissionsTab
              ref={permissionsRef}
              userId={user.id}
              targetIsAdmin={targetIsAdmin}
              onStatusChange={setPermissionsStatus}
            />
          </TabsContent>
          <TabsContent value="limits">
            <LimitsTab ref={limitsRef} userId={user.id} onStatusChange={setLimitsStatus} />
          </TabsContent>
        </Tabs>
      </Modal>

      {/* §11: aviso de cambios sin guardar — mismo patrón que Ajustes (Fase 3), adaptado a pestañas en vez de navegación de página */}
      <Modal
        open={pendingTab !== null || pendingClose}
        onOpenChange={(value) => {
          if (!value) cancelDiscard()
        }}
        title="Cambios sin guardar"
        size="small"
        footer={
          <>
            <Button variant="outline" onClick={cancelDiscard}>
              Seguir editando
            </Button>
            <Button variant="destructive" onClick={confirmDiscard}>
              Descartar cambios
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          Tienes cambios sin guardar en esta pestaña. Si continúas, se perderán.
        </p>
      </Modal>
    </>
  )
}

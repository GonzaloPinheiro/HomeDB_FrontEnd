import { Switch } from '@/shared/components/ui/switch'
import { notAvailableYet } from '@/shared/lib/notAvailableYet'

import { ComingSoonTag, SettingsCard, SettingsPanel, SettingsRow } from '../SettingsLayout'

// PENDIENTE (CLAUDE.md §6.20): no hay notificaciones en el backend (ni ajustes de
// avisos ni envío de correo todavía, §5.4). Los interruptores están apagados y avisan
// al pulsarlos; el día que haya backend, pasan a leer y guardar su valor.
const NOTIFICATIONS: ReadonlyArray<{ id: string; title: string; description: string }> = [
  {
    id: 'uploads',
    title: 'Subidas terminadas',
    description: 'Aviso cuando un archivo grande termina de procesarse.',
  },
  {
    id: 'backups',
    title: 'Copias de seguridad',
    description: 'Resultado de la copia diaria, sobre todo si falla.',
  },
  {
    id: 'server',
    title: 'Alertas del servidor',
    description: 'Temperatura alta, disco casi lleno o errores críticos.',
  },
]

export function NotificationsSection() {
  return (
    <SettingsPanel
      title="Notificaciones"
      description="Elige de qué quieres que te avisemos."
      tag={<ComingSoonTag label="En desarrollo" />}
    >
      <SettingsCard>
        {NOTIFICATIONS.map((item) => (
          <SettingsRow key={item.id} title={item.title} description={item.description}>
            <Switch
              checked={false}
              onCheckedChange={() => notAvailableYet()}
              aria-label={item.title}
            />
          </SettingsRow>
        ))}
      </SettingsCard>
    </SettingsPanel>
  )
}

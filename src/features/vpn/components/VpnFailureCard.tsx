import { FailureCard } from '@/shared/components/FailureCard'

import { VPN_FAILURE_VIEWS, type VpnFailureKind, type VpnFailureView } from '../failures'

type VpnFailureCardProps = {
  kind: VpnFailureKind
  /** Mensaje del error, solo para `other` (el resto tiene su texto propio). */
  message: string
  onRetry: () => void
}

function resolveView(kind: VpnFailureKind, message: string): VpnFailureView {
  if (kind !== 'other') return VPN_FAILURE_VIEWS[kind]
  return { label: 'Error', title: 'No se pudo cargar la VPN', body: message, tone: 'critical', canRetry: true }
}

// CLAUDE.md §6.22: aquí solo vive el TEXTO de cada fallo de la VPN; la tarjeta es la compartida.
export function VpnFailureCard({ kind, message, onRetry }: VpnFailureCardProps) {
  const view = resolveView(kind, message)
  return <FailureCard label={view.label} title={view.title} body={view.body} tone={view.tone} onRetry={view.canRetry ? onRetry : undefined} />
}

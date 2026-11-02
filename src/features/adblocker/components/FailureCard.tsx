import { FailureCard as SharedFailureCard } from '@/shared/components/FailureCard'

import { FAILURE_VIEWS, type AdBlockerFailureKind, type FailureView } from '../failures'

type FailureCardProps = {
  kind: AdBlockerFailureKind
  /** Mensaje del error, solo para `other` (el resto tiene su texto propio). */
  message: string
  onRetry: () => void
}

function resolveView(kind: AdBlockerFailureKind, message: string): FailureView {
  if (kind !== 'other') return FAILURE_VIEWS[kind]
  return { label: 'Error', title: 'No se pudo cargar AdGuard', body: message, tone: 'critical', canRetry: true }
}

// CLAUDE.md §6.21: aquí solo vive el TEXTO de cada fallo de AdGuard; la tarjeta es la compartida.
export function FailureCard({ kind, message, onRetry }: FailureCardProps) {
  const view = resolveView(kind, message)
  return <SharedFailureCard {...view} onRetry={view.canRetry ? onRetry : undefined} />
}

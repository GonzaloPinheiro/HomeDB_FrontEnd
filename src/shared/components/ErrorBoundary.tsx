import { AlertTriangle } from 'lucide-react'
import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'

import { EmptyState } from '@/shared/components/EmptyState'
import { Button } from '@/shared/components/ui/button'

type ErrorBoundaryProps = {
  children: ReactNode
  /** Texto contextual del fallback, ej. "el explorador de archivos". Sin él, mensaje genérico. */
  sectionLabel?: string
}

type ErrorBoundaryState = { hasError: boolean; resetKey: number }

/**
 * CLAUDE.md §6.15 (Fase 7): un fallo inesperado en el render de una pantalla
 * no debe tirar toda la app. Los error boundaries de React solo se pueden
 * escribir como componente de clase — no hay equivalente en hooks todavía.
 * "Reintentar" fuerza un remontaje real de `children` (vía `resetKey`, no solo
 * limpiar `hasError`) para que el estado local roto también se descarte, no
 * solo se oculte el mensaje de error y se vuelva a crashear en el siguiente render.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, resetKey: 0 }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Sin servicio de reporting todavía (§2: no hay CI/monitoring montado) — consola es la red de seguridad actual
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReset = () => {
    this.setState((state) => ({ hasError: false, resetKey: state.resetKey + 1 }))
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center p-6">
          <EmptyState
            icon={AlertTriangle}
            title="Algo ha ido mal"
            description={
              this.props.sectionLabel
                ? `Ha ocurrido un error inesperado en ${this.props.sectionLabel}. Puedes intentar recargar esta sección.`
                : 'Ha ocurrido un error inesperado. Puedes intentar recargar la página.'
            }
            action={
              <Button variant="outline" onClick={this.handleReset}>
                Reintentar
              </Button>
            }
          />
        </div>
      )
    }
    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>
  }
}

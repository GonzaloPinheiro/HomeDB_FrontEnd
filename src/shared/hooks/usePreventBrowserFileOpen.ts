import { useEffect } from 'react'

import { dataTransferHasFiles } from '@/shared/lib/fileDrop'

/**
 * CLAUDE.md §11: soltar un archivo del sistema fuera de una zona de subida
 * haría que el navegador lo abra y saque al usuario de la app. Se anula ese
 * comportamiento por defecto en todo el documento — solo para arrastres que
 * lleven archivos: texto o enlaces siguen soltándose con normalidad en los
 * campos de formulario.
 */
export function usePreventBrowserFileOpen(): void {
  useEffect(() => {
    const prevent = (event: DragEvent) => {
      if (dataTransferHasFiles(event.dataTransfer)) event.preventDefault()
    }
    document.addEventListener('dragover', prevent)
    document.addEventListener('drop', prevent)
    return () => {
      document.removeEventListener('dragover', prevent)
      document.removeEventListener('drop', prevent)
    }
  }, [])
}

import { ArrowUp, Folder, Home, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Modal } from '@/shared/components/Modal'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'

import { useFolderContents, useMoveFile } from '../api'
import type { ExplorerItem } from '../types'

type MoveFileModalProps = {
  open: boolean
  onClose: () => void
  /** Carpeta donde vive el archivo ahora (origen). */
  currentFolderId: number | null
  currentFolderName: string
  item: ExplorerItem
}

type BrowseCrumb = { id: number | null; name: string }

const ROOT: BrowseCrumb = { id: null, name: 'Raíz' }

// CLAUDE.md §11: alternativa sin arrastrar para mover archivos — imprescindible
// para teclado y táctil. Selector sobre el Modal pequeño existente (§6.14) con
// filas-botón nativas: Tab/Enter funcionan sin código extra. Se navega hacia
// dentro con Enter/clic, "Subir" vuelve un nivel visitado y "Raíz" salta arriba.
export function MoveFileModal({
  open,
  onClose,
  currentFolderId,
  currentFolderName,
  item,
}: MoveFileModalProps) {
  // Trail local del selector: empieza en la carpeta actual del archivo
  const [browseTrail, setBrowseTrail] = useState<BrowseCrumb[]>([
    { id: currentFolderId, name: currentFolderName },
  ])
  const browsing = browseTrail[browseTrail.length - 1]

  const contents = useFolderContents(browsing.id)
  const folders = (contents.data ?? []).filter((entry) => entry.kind === 'folder')
  const moveFile = useMoveFile(currentFolderId)

  const close = () => {
    setBrowseTrail([{ id: currentFolderId, name: currentFolderName }])
    onClose()
  }

  const confirm = () => {
    moveFile.mutate(
      { fileId: item.id, targetFolderId: browsing.id },
      { onSuccess: close }, // con FILE_MOVE_ENABLED=false, el hook muestra el toast informativo
    )
  }

  const isSameFolder = browsing.id === currentFolderId

  return (
    <Modal
      open={open}
      onOpenChange={(value) => !value && close()}
      title={`Mover "${item.name}"`}
      size="small"
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={isSameFolder || moveFile.isPending}>
            {moveFile.isPending ? <Loader2 className="animate-spin" /> : null}
            Mover aquí
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-sm">
          <span className="min-w-0 truncate">
            <span className="text-text-secondary">Destino: </span>
            <span className="font-medium text-text-primary">{browsing.name}</span>
          </span>
          <div className="flex shrink-0 gap-1">
            {browseTrail.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBrowseTrail((trail) => trail.slice(0, -1))}
              >
                <ArrowUp />
                Subir
              </Button>
            )}
            {/* Opción explícita de raíz */}
            {browsing.id !== null && (
              <Button variant="ghost" size="sm" onClick={() => setBrowseTrail([ROOT])}>
                <Home />
                Raíz
              </Button>
            )}
          </div>
        </div>

        {contents.isPending ? (
          <div className="flex flex-col gap-2 py-1" aria-hidden>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : folders.length === 0 ? (
          <p className="px-1 py-3 text-sm text-text-muted">
            Sin subcarpetas aquí — puedes mover el archivo a esta carpeta.
          </p>
        ) : (
          <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {folders.map((folder) => (
              <li key={folder.id}>
                {/* Enter/clic entra en la carpeta (accesible por teclado, §11) */}
                <button
                  type="button"
                  onClick={() =>
                    setBrowseTrail((trail) => [...trail, { id: folder.id, name: folder.name }])
                  }
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-alt focus-visible:bg-surface-alt focus-visible:outline-none"
                >
                  <Folder className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                  <span className="truncate">{folder.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {isSameFolder && (
          <p className="text-xs text-text-muted">
            El archivo ya está en esta carpeta — navega a otra para poder moverlo.
          </p>
        )}
      </div>
    </Modal>
  )
}

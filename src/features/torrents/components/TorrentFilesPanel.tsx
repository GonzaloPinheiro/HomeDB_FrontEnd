import { ArrowLeft, CircleAlert, FileQuestion, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { toApiError } from '@/shared/api/client'
import { EmptyState } from '@/shared/components/EmptyState'
import { FloatCard } from '@/shared/components/FloatCard'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { formatBytes } from '@/shared/lib/formatBytes'

import { useTorrentFiles } from '../api'
import { CATEGORY_LABELS } from '../labels'
import { FILES_PANEL_ID } from '../layout'
import { getDownloadSelection } from '../presentation'
import type { Torrent } from '../types'
import { TorrentFileRow } from './TorrentFileRow'

type TorrentFilesPanelProps = {
  torrent: Torrent
  onClose: () => void
  /** En móvil el panel sustituye a la lista: al abrirse hay que llevarle el foco, porque la fila que lo tenía se oculta. */
  moveFocusOnOpen: boolean
}

function FilesSkeleton() {
  return (
    <div className="flex flex-col gap-1" aria-hidden>
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="h-4 w-4 shrink-0" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-6 w-24 shrink-0" />
        </div>
      ))}
    </div>
  )
}

// CLAUDE.md §6.19: panel de ficheros del torrent abierto — qué es cada fichero
// (vídeo principal, subtítulo con idioma, extra, no descargar) y a dónde se
// importará. En escritorio va junto a la lista (340px, fijo mientras se hace scroll);
// por debajo de `lg` ocupa el sitio de la lista y el botón de cabecera es «volver».
// El pie (Restablecer/Guardar) queda siempre a mano: fijo abajo en móvil.
// PENDIENTE (CLAUDE.md §6.19): maqueta — Restablecer y Guardar no hacen nada.
export function TorrentFilesPanel({ torrent, onClose, moveFocusOnOpen }: TorrentFilesPanelProps) {
  const files = useTorrentFiles(torrent.id)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (moveFocusOnOpen) headingRef.current?.focus()
    // Solo al abrir o cambiar de torrent: si cambia `moveFocusOnOpen` (se gira el móvil) no se roba el foco
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torrent.id])

  const list = files.data
  const selection = list ? getDownloadSelection(list) : null

  return (
    <aside
      id={FILES_PANEL_ID}
      aria-label={`Ficheros de ${torrent.name}`}
      className="animate-in fade-in-0 slide-in-from-right-4 duration-200 motion-reduce:animate-none lg:sticky lg:top-4"
    >
      <FloatCard className="flex flex-col lg:max-h-[calc(100vh-5.5rem)] lg:overflow-hidden">
        {/* En móvil el panel ocupa el sitio de la lista: se vuelve con un botón a la izquierda, como en cualquier pantalla de detalle */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="mx-2 mt-2 w-fit gap-1.5 self-start text-text-secondary lg:hidden"
        >
          <ArrowLeft />
          Biblioteca
        </Button>

        <div className="flex items-start justify-between gap-3 p-4 pb-3 max-lg:pt-1">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
              Ficheros{torrent.fileCount > 0 && ` · ${torrent.fileCount}`}
            </p>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="mt-1 break-words text-base font-semibold leading-snug text-text-primary outline-none"
            >
              {torrent.name}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Cerrar ficheros"
            // Solo en escritorio: en móvil se vuelve con el botón de arriba. Área táctil real
            // ~44px sin agrandar el icono visual (CLAUDE.md §10/§11)
            className="relative -mr-1.5 -mt-1 hidden h-8 w-8 shrink-0 text-text-muted after:absolute after:-inset-1.5 after:content-[''] hover:text-text-primary lg:inline-flex"
          >
            <X />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3 lg:overflow-y-auto">
          {torrent.pendingImport && (
            <div className="rounded-xl border border-border-light bg-surface p-3 text-sm text-text-primary">
              <p>
                Se importará a <b className="font-semibold">{CATEGORY_LABELS[torrent.category]}</b> como{' '}
                <b className="font-semibold">{torrent.pendingImport.name}</b>
              </p>
              <p className="mt-2 break-all font-mono text-[11px] text-text-secondary">{torrent.pendingImport.path}</p>
            </div>
          )}

          {files.isPending ? (
            <FilesSkeleton />
          ) : list === undefined ? (
            // `data === undefined` y no `isError` (§7.1)
            <EmptyState
              icon={CircleAlert}
              title="No se pudieron cargar los ficheros"
              description={toApiError(files.error).message}
              className="py-8"
              action={
                <Button variant="outline" onClick={() => void files.refetch()}>
                  Reintentar
                </Button>
              }
            />
          ) : list.length === 0 ? (
            <EmptyState
              icon={FileQuestion}
              title="Sin ficheros todavía"
              description="Aún no se conoce el contenido de este torrent."
              className="py-8"
            />
          ) : (
            <>
              {list.some((file) => file.role !== null) && (
                <p className="text-xs text-text-muted">Roles detectados por nombre y tamaño; puedes cambiarlos.</p>
              )}
              <ul className="-mx-1 flex flex-col">
                {list.map((file) => (
                  <TorrentFileRow key={file.id} file={file} />
                ))}
              </ul>
            </>
          )}
        </div>

        {selection && (
          <div className="sticky bottom-0 flex flex-wrap items-center gap-2 rounded-b-[14px] border-t border-border-light bg-card p-4 lg:static">
            {/* En móvil el resumen ocupa su propia línea: con los dos botones no caben en una */}
            <span className="text-xs text-text-secondary max-sm:basis-full sm:mr-auto">
              {formatBytes(selection.selectedBytes)} de {formatBytes(selection.totalBytes)}
            </span>
            <Button type="button" variant="outline" size="sm" className="max-sm:ml-auto">
              Restablecer
            </Button>
            <Button type="button" size="sm">
              Guardar
            </Button>
          </div>
        )}
      </FloatCard>
    </aside>
  )
}

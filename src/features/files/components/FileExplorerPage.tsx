import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CircleAlert, FolderOpen, FolderPlus, SearchX, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { toApiError } from '@/shared/api/client'
import { EmptyState } from '@/shared/components/EmptyState'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { useDebounce } from '@/shared/hooks/useDebounce'

import { downloadFile, useFolderContents, useMoveFile } from '../api'
import { sortExplorerItems, type SortDirection, type SortKey } from '../sort'
import type { Crumb, ExplorerItem } from '../types'
import { useUploadQueue } from '../uploadQueue/UploadQueueContext'
import { useDwell } from '../useDwell'
import { useFolderPath } from '../useFolderPath'
import { Breadcrumb } from './Breadcrumb'
import { CreateFolderModal } from './CreateFolderModal'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { FileListSkeleton } from './FileListSkeleton'
import { FileRow, ItemIcon } from './FileRow'
import { MoveFileModal } from './MoveFileModal'
import { RenameModal } from './RenameModal'
import { SortableHeader } from './SortableHeader'

const ROOT: Crumb = { id: null, name: 'Inicio' }

// CLAUDE.md §6.5/§7.4: 'upload' ya no es un modal local — abre el panel
// global (UploadQueueProvider, montado en AppShell) pasándole la carpeta
// activa como destino.
type ModalState =
  | { type: 'create' }
  | { type: 'rename'; item: ExplorerItem }
  | { type: 'move'; item: ExplorerItem }
  | { type: 'delete'; item: ExplorerItem }
  | null

type DropTargetData = { type?: 'folder' | 'crumb'; folderId?: number | null; index?: number }

export function FileExplorerPage() {
  // La carpeta actual vive en la URL: sobrevive a un refresco y es compartible
  const [searchParams, setSearchParams] = useSearchParams()
  const folderIdParam = searchParams.get('folderId')
  const folderId = folderIdParam !== null ? Number(folderIdParam) : null

  const [trail, setTrail] = useState<Crumb[]>([ROOT])
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>(null)

  // CLAUDE.md §11: buscador con debounce para no refiltrar en cada tecla
  const debouncedSearch = useDebounce(search)

  // ¿La carpeta actual ya es conocida por la navegación normal dentro de la
  // app (trail acumulado al entrar en carpetas / ir hacia atrás)? Si no, es un
  // deep link o un refresco (F5) directo a esa URL.
  const trailIndex = trail.findIndex((crumb) => crumb.id === folderId)
  const isCurrentTrailTail = trail[trail.length - 1].id === folderId
  const isKnownFromTrail = folderId === null || isCurrentTrailTail || trailIndex >= 0

  // CLAUDE.md §5.5: en un deep link/F5 a una carpeta profunda sin trail previo,
  // se resuelve la ruta real subiendo por ParentFolderId (useFolderPath) en vez
  // de mostrar el marcador genérico de la Fase 2a. Solo se dispara cuando de
  // verdad hace falta (folder no conocido por la navegación normal), para no
  // añadir peticiones de más sobre lo que ya está en caché de una navegación
  // normal (§6.3).
  const folderPath = useFolderPath(folderId, !isKnownFromTrail)

  // Trail reconciliado con la URL, derivado en render (atrás/adelante del
  // navegador, deep links). Mientras useFolderPath resuelve o si fallara, el
  // marcador genérico actúa de red de seguridad — nunca debe romper la pantalla.
  // No hace falta escribir el resultado de vuelta en `trail`: en cuanto el
  // usuario navega desde aquí (enterFolder/goToCrumb toman `displayTrail`, no
  // `trail`, como base), los nombres reales ya resueltos pasan a formar parte
  // del trail de navegación normal sin ninguna petición adicional.
  const displayTrail = useMemo(() => {
    if (folderId === null) return [ROOT]
    if (isCurrentTrailTail) return trail
    if (trailIndex >= 0) return trail.slice(0, trailIndex + 1)
    return folderPath.data ?? [ROOT, { id: folderId, name: 'Carpeta' }]
  }, [trail, folderId, isCurrentTrailTail, trailIndex, folderPath.data])

  // CLAUDE.md §11: evitar que soltar un archivo fuera de la zona de subida haga
  // que el navegador lo abra y saque al usuario de la app. No interfiere con
  // dnd-kit: sus sensores usan eventos de puntero, no HTML5 dragover/drop.
  useEffect(() => {
    const prevent = (event: Event) => event.preventDefault()
    document.addEventListener('dragover', prevent)
    document.addEventListener('drop', prevent)
    return () => {
      document.removeEventListener('dragover', prevent)
      document.removeEventListener('drop', prevent)
    }
  }, [])

  const contents = useFolderContents(folderId)
  const moveFile = useMoveFile(folderId)
  const uploadQueue = useUploadQueue()

  // Drag & drop (§6.3/§7.5): sensores de puntero, nunca HTML5 DnD (§10)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const [activeDrag, setActiveDrag] = useState<ExplorerItem | null>(null)
  const [dwellKey, setDwellKey] = useState<string | null>(null)

  const navigateTo = (crumbId: number | null) => {
    setSearch('')
    setSearchParams(crumbId === null ? {} : { folderId: String(crumbId) })
  }

  const enterFolder = (item: ExplorerItem) => {
    setTrail([...displayTrail, { id: item.id, name: item.name }])
    navigateTo(item.id)
  }

  const goToCrumb = (index: number) => {
    setTrail(displayTrail.slice(0, index + 1))
    navigateTo(displayTrail[index].id)
  }

  // §6.3: mantener el arrastre ~800ms sobre un segmento del breadcrumb navega
  // a esa carpeta sin soltar (se cancela al salir de encima o soltar antes)
  useDwell(dwellKey, (key) => {
    const index = Number(key.slice('crumb-'.length))
    if (Number.isInteger(index) && index >= 0 && index < displayTrail.length) {
      goToCrumb(index)
    }
  })

  const onDragStart = (event: DragStartEvent) => {
    const item = event.active.data.current?.item as ExplorerItem | undefined
    setActiveDrag(item ?? null)
  }

  const onDragOver = (event: DragOverEvent) => {
    const target = event.over?.data.current as DropTargetData | undefined
    setDwellKey(target?.type === 'crumb' && target.index !== undefined ? `crumb-${target.index}` : null)
  }

  const onDragCancel = () => {
    setActiveDrag(null)
    setDwellKey(null)
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null)
    setDwellKey(null)
    const item = event.active.data.current?.item as ExplorerItem | undefined
    const target = event.over?.data.current as DropTargetData | undefined
    if (!item || item.kind !== 'file' || !target?.type) return
    const targetFolderId = target.folderId ?? null
    if (targetFolderId === folderId) return // soltar en la carpeta actual no mueve nada
    moveFile.mutate({ fileId: item.id, targetFolderId })
  }

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  // PENDIENTE (CLAUDE.md §5.4): sustituir por búsqueda global cuando exista el
  // endpoint — hoy solo filtra en cliente lo ya cargado de la carpeta actual (§6.3)
  const visibleItems = useMemo(() => {
    const items = contents.data ?? []
    const term = debouncedSearch.trim().toLowerCase()
    const filtered = term ? items.filter((item) => item.name.toLowerCase().includes(term)) : items
    return sortExplorerItems(filtered, sortKey, sortDirection)
  }, [contents.data, debouncedSearch, sortKey, sortDirection])

  const onDownload = (item: ExplorerItem) => {
    // §6.4/§11: feedback breve; el progreso real lo gestiona el navegador
    toast(`Descargando "${item.name}"…`)
    downloadFile(item.id, item.name).catch((error: unknown) => {
      toast.error(toApiError(error).message)
    })
  }

  const currentFolderName = displayTrail[displayTrail.length - 1].name
  const isSearching = debouncedSearch.trim().length > 0

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
    <div className="flex min-h-full flex-col gap-4 p-4 md:p-6">
      {/* Cabecera del panel (§6.2): breadcrumb + buscador + acciones */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <Breadcrumb crumbs={displayTrail} onNavigate={goToCrumb} />
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar en esta carpeta"
          className="h-9 w-full sm:w-56"
          aria-label="Buscar en esta carpeta"
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setModal({ type: 'create' })}>
            <FolderPlus />
            <span className="hidden sm:inline">Nueva carpeta</span>
          </Button>
          <Button onClick={() => uploadQueue.openPanel({ folderId, folderName: currentFolderName })}>
            <Upload />
            <span className="hidden sm:inline">Subir</span>
          </Button>
        </div>
      </div>

      {/* Cabeceras de columna ordenables (§6.3) */}
      <div className="flex items-center gap-3 border-b border-border-light px-3 pb-2">
        <span className="w-5 shrink-0" aria-hidden />
        <SortableHeader
          label="Nombre"
          sortKey="name"
          activeKey={sortKey}
          direction={sortDirection}
          onSort={onSort}
          className="min-w-0 flex-1"
        />
        <SortableHeader
          label="Tamaño"
          sortKey="size"
          activeKey={sortKey}
          direction={sortDirection}
          onSort={onSort}
          className="hidden w-20 shrink-0 justify-end sm:flex"
        />
        <SortableHeader
          label="Fecha"
          sortKey="date"
          activeKey={sortKey}
          direction={sortDirection}
          onSort={onSort}
          className="hidden w-24 shrink-0 justify-end md:flex"
        />
        <span className="w-8 shrink-0" aria-hidden />
      </div>

      {/* Lista */}
      {contents.isPending ? (
        <FileListSkeleton />
      ) : contents.isError ? (
        <EmptyState
          icon={CircleAlert}
          title="No se pudo cargar la carpeta"
          description={toApiError(contents.error).message}
          action={
            <Button variant="outline" onClick={() => void contents.refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : visibleItems.length === 0 && isSearching ? (
        <EmptyState
          icon={SearchX}
          title="Sin resultados"
          description={`Nada en esta carpeta coincide con "${debouncedSearch.trim()}".`}
          action={
            <Button variant="outline" onClick={() => setSearch('')}>
              Limpiar búsqueda
            </Button>
          }
        />
      ) : visibleItems.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Carpeta vacía"
          description="Sube un archivo o crea una carpeta para empezar."
          action={
            <Button onClick={() => uploadQueue.openPanel({ folderId, folderName: currentFolderName })}>
              <Upload />
              Subir archivo
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col">
          {visibleItems.map((item) => (
            <FileRow
              key={`${item.kind}-${item.id}`}
              item={item}
              onEnterFolder={enterFolder}
              onDownload={onDownload}
              onRename={(target) => setModal({ type: 'rename', item: target })}
              onMove={(target) => setModal({ type: 'move', item: target })}
              onDelete={(target) => setModal({ type: 'delete', item: target })}
            />
          ))}
        </div>
      )}

      {/* Modales (§6.4) */}
      <CreateFolderModal
        open={modal?.type === 'create'}
        onClose={() => setModal(null)}
        parentFolderId={folderId}
      />
      {modal?.type === 'rename' && (
        <RenameModal open onClose={() => setModal(null)} parentFolderId={folderId} item={modal.item} />
      )}
      {modal?.type === 'move' && (
        <MoveFileModal
          open
          onClose={() => setModal(null)}
          currentFolderId={folderId}
          currentFolderName={currentFolderName}
          item={modal.item}
        />
      )}
      {modal?.type === 'delete' && (
        <DeleteConfirmModal open onClose={() => setModal(null)} parentFolderId={folderId} item={modal.item} />
      )}
    </div>

    {/* Vista fantasma del archivo mientras se arrastra */}
    <DragOverlay dropAnimation={null}>
      {activeDrag ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-primary shadow-md">
          <ItemIcon item={activeDrag} className="h-4 w-4" />
          <span className="max-w-56 truncate">{activeDrag.name}</span>
        </div>
      ) : null}
    </DragOverlay>
    </DndContext>
  )
}

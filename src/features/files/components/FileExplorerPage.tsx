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
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { toApiError } from '@/shared/api/client'
import { EmptyState } from '@/shared/components/EmptyState'
import { DropOverlay } from '@/shared/components/DropOverlay'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useFileDropZone } from '@/shared/hooks/useFileDropZone'

import { downloadFile, useBulkMove, useFolderContents, useMoveFile } from '../api'
import { sortExplorerItems, type SortDirection, type SortKey } from '../sort'
import type { Crumb, ExplorerItem } from '../types'
import { useUploadQueue } from '../uploadQueue/UploadQueueContext'
import { useDwell } from '../useDwell'
import { useExplorerShortcuts } from '../useExplorerShortcuts'
import { useFileSelection } from '../useFileSelection'
import { useFolderPath } from '../useFolderPath'
import { useViewMode } from '../useViewMode'
import { Breadcrumb } from './Breadcrumb'
import { BulkDeleteModal } from './BulkDeleteModal'
import { CreateFolderModal } from './CreateFolderModal'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { ExplorerColumnHeaders } from './ExplorerColumnHeaders'
import { FileCard } from './FileCard'
import { FileGridSkeleton, FileListSkeleton } from './FileListSkeleton'
import { FileRow } from './FileRow'
import { GRID_CLASSES } from './explorerLayout'
import { ItemIcon } from './ItemIcon'
import { MoveFileModal } from './MoveFileModal'
import { RenameModal } from './RenameModal'
import { SelectionHeader } from './SelectionHeader'
import { ViewModeToggle } from './ViewModeToggle'

const ROOT: Crumb = { id: null, name: 'Archivos' }

// CLAUDE.md §6.5/§7.4: 'upload' ya no es un modal local — abre el panel
// global (UploadQueueProvider, montado en AppShell) pasándole la carpeta
// activa como destino.
type ModalState =
  | { type: 'create' }
  | { type: 'rename'; item: ExplorerItem }
  | { type: 'move'; item: ExplorerItem }
  | { type: 'delete'; item: ExplorerItem }
  // Selección múltiple (§6.3): los elementos se fijan al abrir el modal — si la
  // lista cambia detrás, el modal sigue hablando de lo que el usuario confirmó.
  | { type: 'bulkDelete'; items: ExplorerItem[] }
  | { type: 'bulkMove'; items: ExplorerItem[] }
  | null

type DropTargetData = { type?: 'folder' | 'crumb'; folderId?: number | null; index?: number }

export function FileExplorerPage() {
  // La carpeta actual vive en la URL: sobrevive a un refresco y es compartible
  const [searchParams, setSearchParams] = useSearchParams()
  // Un ?folderId= manipulado a mano ("abc", "-3", "1.5") no es un id válido: se
  // trata como raíz en vez de pedir /folders/NaN/subfolders al backend.
  const folderIdParam = Number(searchParams.get('folderId'))
  const folderId = Number.isInteger(folderIdParam) && folderIdParam > 0 ? folderIdParam : null

  const [trail, setTrail] = useState<Crumb[]>([ROOT])
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>(null)
  // CLAUDE.md §6.3b: lista (iconos) o miniaturas, recordado en este dispositivo
  const [viewMode, setViewMode] = useViewMode()

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

  const contents = useFolderContents(folderId)
  const moveFile = useMoveFile(folderId)
  const bulkMove = useBulkMove(folderId)
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
    // §6.3: arrastrar un archivo que forma parte de la selección arrastra TODOS los
    // archivos seleccionados; si no está seleccionado, solo ese (como en el Explorador).
    const files = draggedFiles(item)
    if (files.length > 1) bulkMove.mutate({ files, targetFolderId })
    else moveFile.mutate({ fileId: item.id, targetFolderId })
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

  // CLAUDE.md §6.3: selección múltiple — casillas, Ctrl/Cmd+clic, Shift+clic y
  // atajos de teclado. Se acota a la carpeta y a lo visible (useFileSelection).
  const selection = useFileSelection(folderId, visibleItems)
  // Las carpetas no se mueven (solo se arrastran y mueven archivos, §6.3/§7.5).
  const selectedFiles = selection.selectedItems.filter((item) => item.kind === 'file')

  // Arrastrar un archivo seleccionado arrastra todos los archivos seleccionados.
  const draggedFiles = (item: ExplorerItem): ExplorerItem[] => (selection.isSelected(item) ? selectedFiles : [item])

  // Con uno solo se reutilizan los modales de siempre (texto específico de
  // carpeta/archivo); con varios, los de lote.
  const openDeleteSelected = () => {
    const items = selection.selectedItems
    if (items.length === 0) return
    setModal(items.length === 1 ? { type: 'delete', item: items[0] } : { type: 'bulkDelete', items })
  }
  const openMoveSelected = () => {
    if (selectedFiles.length === 0) return
    setModal(selectedFiles.length === 1 ? { type: 'move', item: selectedFiles[0] } : { type: 'bulkMove', items: selectedFiles })
  }
  // F2: renombrar es de un solo elemento — con varios seleccionados no hace nada
  const openRenameSelected = () => {
    if (selection.count === 1) setModal({ type: 'rename', item: selection.selectedItems[0] })
  }

  useExplorerShortcuts(
    {
      onDelete: openDeleteSelected,
      onRename: openRenameSelected,
      onSelectAll: selection.selectAll,
      onClear: selection.clear,
    },
    { enabled: modal === null, hasSelection: selection.count > 0 },
  )

  const onDownload = (item: ExplorerItem) => {
    // §6.4/§11: feedback breve; el progreso real lo gestiona el navegador
    toast(`Descargando "${item.name}"…`)
    downloadFile(item.id, item.name).catch((error: unknown) => {
      toast.error(toApiError(error).message)
    })
  }

  const currentFolderName = displayTrail[displayTrail.length - 1].name
  const isSearching = debouncedSearch.trim().length > 0

  // CLAUDE.md §6.3: soltar archivos del sistema en cualquier parte de la pantalla
  // (o pegarlos con Ctrl/Cmd+V) los sube a la carpeta que se está viendo, sin
  // pasar por el botón "Subir". Es HTML5 DnD nativo (useFileDropZone), no dnd-kit:
  // el arrastre INTERNO de archivos entre carpetas (§7.5) sigue yendo por dnd-kit
  // y no emite eventos `drag*`, así que no se mezclan. El panel de subidas no se
  // abre: la bandeja (§6.16) y este aviso bastan, y no interrumpe lo que se hacía.
  const { isDragging } = useFileDropZone({
    scope: 'window',
    acceptPaste: true,
    onFiles: (files) => {
      const queued = uploadQueue.addFiles(files, { folderId, folderName: currentFolderName })
      if (queued > 0) {
        toast.success(`Subiendo ${queued} ${queued === 1 ? 'archivo' : 'archivos'} a "${currentFolderName}"`)
      }
    },
  })

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
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
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

      {/* Cabeceras de columna ordenables (§6.3), o la barra de selección si hay algo marcado */}
      {selection.count > 0 ? (
        <SelectionHeader
          count={selection.count}
          allSelected={selection.allSelected}
          canMove={selectedFiles.length > 0}
          onToggleAll={selection.toggleAll}
          onMove={openMoveSelected}
          onDelete={openDeleteSelected}
          onClear={selection.clear}
        />
      ) : (
        <ExplorerColumnHeaders
          viewMode={viewMode}
          visibleCount={visibleItems.length}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={onSort}
          onToggleAll={selection.toggleAll}
        />
      )}

      {/* Lista */}
      {contents.isPending ? (
        viewMode === 'grid' ? <FileGridSkeleton /> : <FileListSkeleton />
      ) : contents.data === undefined ? (
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
        <div className={viewMode === 'grid' ? GRID_CLASSES : 'flex flex-col'}>
          {visibleItems.map((item) => {
            // Mismas props en ambos modos: solo cambia la presentación (§6.3b)
            const ItemView = viewMode === 'grid' ? FileCard : FileRow
            return (
              <ItemView
                key={`${item.kind}-${item.id}`}
                item={item}
                onEnterFolder={enterFolder}
                onDownload={onDownload}
                onRename={(target) => setModal({ type: 'rename', item: target })}
                onMove={(target) => setModal({ type: 'move', item: target })}
                onDelete={(target) => setModal({ type: 'delete', item: target })}
                selected={selection.isSelected(item)}
                selectionActive={selection.count > 0}
                onSelect={selection.select}
              />
            )
          })}
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
          items={[modal.item]}
        />
      )}
      {modal?.type === 'bulkMove' && (
        <MoveFileModal
          open
          onClose={() => setModal(null)}
          currentFolderId={folderId}
          currentFolderName={currentFolderName}
          items={modal.items}
        />
      )}
      {modal?.type === 'bulkDelete' && (
        <BulkDeleteModal open onClose={() => setModal(null)} parentFolderId={folderId} items={modal.items} />
      )}
      {modal?.type === 'delete' && (
        <DeleteConfirmModal open onClose={() => setModal(null)} parentFolderId={folderId} item={modal.item} />
      )}
    </div>

    <DropOverlay
      visible={isDragging}
      title={`Suelta para subir a "${currentFolderName}"`}
      description="Los archivos se añaden a la cola de subida de esta carpeta."
    />

    {/* Vista fantasma del archivo mientras se arrastra */}
    <DragOverlay dropAnimation={null}>
      {activeDrag ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-primary shadow-md">
          <ItemIcon item={activeDrag} className="h-4 w-4" />
          <span className="max-w-56 truncate">
            {draggedFiles(activeDrag).length > 1 ? `${draggedFiles(activeDrag).length} archivos` : activeDrag.name}
          </span>
        </div>
      ) : null}
    </DragOverlay>
    </DndContext>
  )
}

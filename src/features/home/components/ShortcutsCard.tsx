import { FolderOpen, TrendingUp, UploadCloud, Wallet, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { useUploadQueue } from '@/features/files/uploadQueue/UploadQueueContext'
import { usePermissions } from '@/shared/hooks/usePermissions'
import { cn } from '@/shared/lib/utils'

import { FloatCard } from './FloatCard'

const TILE_CLASS =
  'flex min-h-[88px] flex-col justify-between gap-3 rounded-[9px] border border-border bg-surface p-[15px] text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

type TileContentProps = { icon: LucideIcon; title: string; caption: string }

function TileContent({ icon: Icon, title, caption }: TileContentProps) {
  return (
    <>
      <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-border bg-card">
        <Icon className="h-4 w-4 text-accent" aria-hidden />
      </div>
      <div>
        <div className="text-[13px] font-semibold text-text-primary">{title}</div>
        <div className="mt-0.5 text-[11px] text-text-muted">{caption}</div>
      </div>
    </>
  )
}

type ShortcutProps = TileContentProps & {
  /** Navegar a una ruta, o ejecutar una acción — nunca ambas. */
  to?: string
  onClick?: () => void
  /** Sin acceso o sin funcionalidad: se atenúa y no navega. */
  disabled?: boolean
}

function Shortcut({ to, onClick, disabled = false, ...content }: ShortcutProps): ReactNode {
  if (disabled) {
    return (
      <div className={cn(TILE_CLASS, 'cursor-not-allowed opacity-60')} aria-disabled>
        <TileContent {...content} />
      </div>
    )
  }
  if (to) {
    return (
      <Link to={to} className={cn(TILE_CLASS, 'hover:bg-surface-alt')}>
        <TileContent {...content} />
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cn(TILE_CLASS, 'hover:bg-surface-alt')}>
      <TileContent {...content} />
    </button>
  )
}

// Atajos del diseño de Inicio (§6.18). Los dos de Archivos son reales y exigen el
// módulo Files; "Nuevo gasto" y "Ver cartera" son la base para cuando existan
// Gastos e Inversiones (§5.3, módulos fantasma): avisan en vez de hacer nada.
// El diseño tenía "Nueva carpeta" ("en Documentos"): crear carpetas vive dentro
// del explorador (modal con su carpeta actual), así que aquí se ofrece "Explorar
// archivos" en su lugar, en vez de un atajo que no podría crear nada.
export function ShortcutsCard() {
  const { hasModule } = usePermissions()
  const { openPanel } = useUploadQueue()
  const hasFiles = hasModule('Files')

  return (
    <FloatCard className="flex min-h-0 flex-1 flex-col px-[22px] py-5">
      <h2 className="text-[15px] font-semibold text-text-primary">Atajos</h2>
      <div className="mt-3.5 grid flex-1 grid-cols-2 gap-2.5">
        <Shortcut
          icon={UploadCloud}
          title="Subir archivo"
          caption={hasFiles ? 'a la raíz de Archivos' : 'Módulo no activado'}
          disabled={!hasFiles}
          // Sin carpeta actual en Inicio, el destino es la raíz (folderId null, §5.4)
          onClick={() => openPanel({ folderId: null, folderName: 'Archivos' })}
        />
        <Shortcut
          icon={FolderOpen}
          title="Explorar archivos"
          caption={hasFiles ? 'carpetas y documentos' : 'Módulo no activado'}
          disabled={!hasFiles}
          to="/files"
        />
        {/* PENDIENTE (CLAUDE.md §5.3/§6.18): sin módulo Gastos todavía */}
        <Shortcut
          icon={Wallet}
          title="Nuevo gasto"
          caption="Próximamente"
          onClick={() => toast.info('Todavía no disponible')}
        />
        {/* PENDIENTE (CLAUDE.md §5.3/§6.18): sin módulo Inversiones todavía */}
        <Shortcut
          icon={TrendingUp}
          title="Ver cartera"
          caption="Próximamente"
          onClick={() => toast.info('Todavía no disponible')}
        />
      </div>
    </FloatCard>
  )
}

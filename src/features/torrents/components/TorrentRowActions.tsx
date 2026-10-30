import { MoreHorizontal } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { cn } from '@/shared/lib/utils'

import { getTorrentActions } from '../actions'
import type { Torrent } from '../types'
import { ACTION_ICONS } from './actionIcons'

// Área táctil real ~44px sin agrandar el icono visual (CLAUDE.md §10/§11)
const ICON_BUTTON = "relative h-8 w-8 after:absolute after:-inset-1.5 after:content-['']"

// CLAUDE.md §6.19: la acción principal del estado, siempre visible en la fila, y
// un menú «⋯» con el resto (secundarias, comunes y destructivas al final).
// PENDIENTE (CLAUDE.md §6.19): maqueta — ni los botones ni los elementos del menú
// hacen nada; al conectar el backend, cada acción recibirá su mutation (§7.1).
export function TorrentRowActions({ torrent, selected }: { torrent: Torrent; selected: boolean }) {
  const { primary, menu, destructive } = getTorrentActions(torrent.status)
  const PrimaryIcon = ACTION_ICONS[primary.id]

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title={primary.label}
        aria-label={`${primary.label}: ${torrent.name}`}
        // Al pasar el ratón por la fila (o seleccionada) el botón principal cobra forma de botón
        className={cn(
          ICON_BUTTON,
          'border border-transparent text-text-primary group-hover:border-border group-hover:bg-card group-hover:shadow-sm',
          selected && 'border-border bg-card shadow-sm',
        )}
      >
        <PrimaryIcon />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Más acciones de ${torrent.name}`}
            className={cn(ICON_BUTTON, 'text-text-muted hover:text-text-primary')}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[13rem]">
          {menu.map((action) => {
            const Icon = ACTION_ICONS[action.id]
            return (
              <DropdownMenuItem key={action.id}>
                <Icon aria-hidden />
                {action.label}
              </DropdownMenuItem>
            )
          })}
          {destructive.length > 0 && <DropdownMenuSeparator />}
          {destructive.map((action) => {
            const Icon = ACTION_ICONS[action.id]
            return (
              <DropdownMenuItem key={action.id} className="items-start text-critical-text focus:text-critical-text">
                <Icon className="mt-0.5" aria-hidden />
                <span className="flex flex-col">
                  {action.label}
                  {action.description && (
                    <span className="text-xs font-normal text-text-muted">{action.description}</span>
                  )}
                </span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

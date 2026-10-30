import { Plus, Search } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'

import { MockBadge } from '../mock/MockBadge'

// CLAUDE.md §6.19: cabecera con el mismo ritmo que Inicio y Monitor (§6.18, §6.13):
// línea secundaria + título grande a la izquierda, buscador y acción principal a la derecha.
// PENDIENTE (CLAUDE.md §6.19): maqueta — el buscador no filtra y "Añadir torrent"
// no abre nada. Con backend, el buscador filtrará en cliente con debounce
// (`useDebounce`, §11) o por API, y "Añadir" abrirá un modal (archivo .torrent / magnet).
export function TorrentsHeader() {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {/* div y no p: el Badge de la maqueta es un div */}
        <div className="mb-1.5 flex items-center gap-2 text-[13px] text-text-secondary">
          Torrents
          <MockBadge />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-[30px]">Biblioteca</h1>
      </div>

      <div className="flex w-full items-center gap-2 sm:w-auto">
        <div className="relative flex-1 sm:w-64 sm:flex-none">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
          <Input type="search" placeholder="Buscar torrent" aria-label="Buscar torrent" className="pl-9" />
        </div>
        <Button type="button">
          <Plus />
          <span className="sm:hidden">Añadir</span>
          <span className="hidden sm:inline">Añadir torrent</span>
        </Button>
      </div>
    </header>
  )
}

import { MockBadge } from '../mock/MockBadge'

// CLAUDE.md §6.21: cabecera con el mismo ritmo que Inicio, Monitor y Torrents (§6.18, §6.13,
// §6.19): línea secundaria + título grande. A la derecha, el host del panel de AdGuard
// cuando se conoce.
export function AdBlockerHeader({ panelHost }: { panelHost: string | null }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {/* div y no p: el Badge de la maqueta es un div */}
        <div className="mb-1.5 flex items-center gap-2 text-[13px] text-text-secondary">
          Red doméstica
          <MockBadge />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-[30px]">AdGuard</h1>
      </div>
      {panelHost !== null && (
        <span className="hidden font-mono text-xs text-text-muted-2 sm:inline">{panelHost} · AdGuard Home</span>
      )}
    </header>
  )
}

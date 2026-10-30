import { useQuery } from '@tanstack/react-query'

import { listTorrentFiles, listTorrents } from './mock/mockApi'

// CLAUDE.md §6.19, §7.1: único punto de acceso a datos de Torrents — los
// componentes solo conocen estos hooks.
// PENDIENTE (CLAUDE.md §6.19): hoy leen de `./mock/mockApi` porque el backend aún no
// tiene endpoints de torrents (solo el flag de módulo, §5.3). Al implementarlos:
//   1. Releer el código real del backend (§2) y documentar los endpoints en §5.4.
//   2. Sustituir cada `queryFn` por la llamada real con `api` + `unwrap` + schema
//      de Zod (`schemas.ts`), y ajustar `types.ts` a la forma real.
//   3. Para las descargas activas, añadir `refetchInterval` (como hace el Monitor,
//      §7.9) y cuidar que no gaste el rate limit global (§7.4).
//   4. Borrar la carpeta `mock/` y el `<MockBadge />` de `TorrentsHeader`.
// Los componentes no deberían necesitar ningún cambio.

export const torrentKeys = {
  all: ['torrents'] as const,
  list: () => [...torrentKeys.all, 'list'] as const,
  files: (torrentId: number) => [...torrentKeys.all, 'files', torrentId] as const,
}

export function useTorrents() {
  return useQuery({
    queryKey: torrentKeys.list(),
    queryFn: listTorrents,
  })
}

export function useTorrentFiles(torrentId: number) {
  return useQuery({
    queryKey: torrentKeys.files(torrentId),
    queryFn: () => listTorrentFiles(torrentId),
  })
}

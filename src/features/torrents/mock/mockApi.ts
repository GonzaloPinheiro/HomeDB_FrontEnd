import type { Torrent, TorrentFile } from '../types'
import { MOCK_TORRENT_FILES, MOCK_TORRENTS } from './data'

// CLAUDE.md §6.19: sustituto del backend de Torrents, que todavía no existe.
// Devuelve los datos de `data.ts` tras una latencia simulada, para que los
// skeletons y estados de carga se ejerciten igual que lo harán con la red real.
// Las funciones imitan la forma de lo que serán las llamadas HTTP (async, sin
// parámetros de UI) para que `api.ts` cambie solo por dentro al conectar el backend.

const LATENCY_MS = 350

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function listTorrents(): Promise<Torrent[]> {
  await wait(LATENCY_MS)
  return MOCK_TORRENTS
}

export async function listTorrentFiles(torrentId: number): Promise<TorrentFile[]> {
  await wait(LATENCY_MS)
  return MOCK_TORRENT_FILES[torrentId] ?? []
}

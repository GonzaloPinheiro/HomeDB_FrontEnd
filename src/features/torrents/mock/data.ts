import type { Torrent, TorrentFile } from '../types'

// CLAUDE.md §6.19: DATOS DE EJEMPLO de la maqueta de Torrents — nada de esto existe
// en el backend. Editar a mano libremente para probar estados y longitudes de texto.
// Se borra junto con el resto de `mock/` cuando exista el backend real.

const KB = 1024
const MB = 1024 * KB
const GB = 1024 * MB

function file(id: number, name: string, sizeBytes: number, role: TorrentFile['role'], language: string | null = null): TorrentFile {
  return { id, name, sizeBytes, role, language }
}

function totalSize(files: readonly TorrentFile[]): number {
  return files.reduce((sum, item) => sum + item.sizeBytes, 0)
}

// ---- Ficheros por torrent (clave: id del torrent) -----------------------

export const MOCK_TORRENT_FILES: Record<number, TorrentFile[]> = {
  1: [
    file(101, 'documental.1080p.mkv', 3.5 * GB, 'mainVideo'),
    file(102, 'es.srt', 84 * KB, 'subtitle', 'es'),
    file(103, 'en.srt', 81 * KB, 'subtitle', 'en'),
    file(104, 'making-of.mkv', 420 * MB, 'extra'),
    file(105, 'sample.mkv', 210 * MB, 'skip'),
    file(106, 'release.nfo', 4 * KB, 'skip'),
  ],
  // Un curso de 22 lecciones: sirve para ver la lista de ficheros con scroll
  2: Array.from({ length: 22 }, (_, index) =>
    file(201 + index, `Leccion ${String(index + 1).padStart(2, '0')}.mp4`, 480 * MB, 'mainVideo'),
  ),
  3: [
    file(301, 'Serie.documental.T02E01.mkv', 1.6 * GB, 'mainVideo'),
    file(302, 'Serie.documental.T02E02.mkv', 1.6 * GB, 'mainVideo'),
    file(303, 'Serie.documental.T02E03.mkv', 1.6 * GB, 'mainVideo'),
    file(304, 'Serie.documental.T02E04.mkv', 1.6 * GB, 'mainVideo'),
  ],
  4: [file(401, 'distro-x-2.1-amd64.iso', 3.2 * GB, null)],
  5: [file(501, 'ubuntu-24.04-desktop-amd64.iso', 5.8 * GB, null)],
  6: [
    ...Array.from({ length: 10 }, (_, index) =>
      file(601 + index, `${String(index + 1).padStart(2, '0')} - Pista ${index + 1}.flac`, 190 * MB, null),
    ),
    file(611, 'cover.jpg', 1.2 * MB, null),
    file(612, 'concierto.cue', 3 * KB, null),
  ],
  7: Array.from({ length: 5 }, (_, index) => file(701 + index, `Libro ${index + 1}.epub`, 64 * MB, null)),
}

// ---- Torrents -----------------------------------------------------------

export const MOCK_TORRENTS: Torrent[] = [
  {
    id: 1,
    name: 'Documental naturaleza (2024) 1080p',
    category: 'movies',
    status: 'downloading',
    sizeBytes: totalSize(MOCK_TORRENT_FILES[1]),
    fileCount: MOCK_TORRENT_FILES[1].length,
    progressPercent: 63,
    downloadBytesPerSec: 12 * MB,
    etaSeconds: 6 * 60,
    queuePosition: null,
    pausedAt: null,
    ratio: null,
    ratioTarget: null,
    errorMessage: null,
    pendingImport: {
      name: 'Documental naturaleza (2024)',
      path: '/media/peliculas/Documental naturaleza (2024)/',
    },
    addedAt: '2026-10-30T17:20:00Z',
  },
  {
    id: 2,
    name: 'Curso de fotografía · T1',
    category: 'series',
    status: 'queued',
    sizeBytes: totalSize(MOCK_TORRENT_FILES[2]),
    fileCount: MOCK_TORRENT_FILES[2].length,
    progressPercent: null,
    downloadBytesPerSec: null,
    etaSeconds: null,
    queuePosition: 1,
    pausedAt: null,
    ratio: null,
    ratioTarget: null,
    errorMessage: null,
    pendingImport: { name: 'Curso de fotografía', path: '/media/series/Curso de fotografía/Temporada 1/' },
    addedAt: '2026-10-30T17:24:00Z',
  },
  {
    id: 3,
    name: 'Serie documental · T2 E01–E04',
    category: 'series',
    status: 'paused',
    sizeBytes: totalSize(MOCK_TORRENT_FILES[3]),
    fileCount: MOCK_TORRENT_FILES[3].length,
    progressPercent: 28,
    downloadBytesPerSec: null,
    etaSeconds: null,
    queuePosition: null,
    pausedAt: '2026-10-30T17:02:00Z',
    ratio: null,
    ratioTarget: null,
    errorMessage: null,
    pendingImport: { name: 'Serie documental', path: '/media/series/Serie documental/Temporada 2/' },
    addedAt: '2026-10-29T20:10:00Z',
  },
  {
    id: 4,
    name: 'Distribución Linux X',
    category: 'software',
    status: 'seeding',
    sizeBytes: totalSize(MOCK_TORRENT_FILES[4]),
    fileCount: MOCK_TORRENT_FILES[4].length,
    progressPercent: 100,
    downloadBytesPerSec: null,
    etaSeconds: null,
    queuePosition: null,
    pausedAt: null,
    ratio: 1.4,
    ratioTarget: 2,
    errorMessage: null,
    pendingImport: null,
    addedAt: '2026-10-11T09:00:00Z',
  },
  {
    id: 5,
    name: 'ubuntu-24.04-desktop-amd64.iso',
    category: 'software',
    status: 'completed',
    sizeBytes: totalSize(MOCK_TORRENT_FILES[5]),
    fileCount: MOCK_TORRENT_FILES[5].length,
    progressPercent: 100,
    downloadBytesPerSec: null,
    etaSeconds: null,
    queuePosition: null,
    pausedAt: null,
    ratio: 2,
    ratioTarget: 2,
    errorMessage: null,
    pendingImport: null,
    addedAt: '2026-10-09T18:30:00Z',
  },
  {
    id: 6,
    name: 'Concierto en directo FLAC',
    category: 'music',
    status: 'error',
    sizeBytes: totalSize(MOCK_TORRENT_FILES[6]),
    fileCount: MOCK_TORRENT_FILES[6].length,
    progressPercent: 47,
    downloadBytesPerSec: null,
    etaSeconds: null,
    queuePosition: null,
    pausedAt: null,
    ratio: null,
    ratioTarget: null,
    errorMessage: 'Disco sin espacio',
    pendingImport: { name: 'Concierto en directo', path: '/media/musica/Concierto en directo/' },
    addedAt: '2026-10-08T21:45:00Z',
  },
  {
    id: 7,
    name: 'Colección dominio público (epub)',
    category: 'books',
    status: 'contentDeleted',
    sizeBytes: totalSize(MOCK_TORRENT_FILES[7]),
    fileCount: MOCK_TORRENT_FILES[7].length,
    progressPercent: null,
    downloadBytesPerSec: null,
    etaSeconds: null,
    queuePosition: null,
    pausedAt: null,
    ratio: null,
    ratioTarget: null,
    errorMessage: null,
    pendingImport: null,
    addedAt: '2026-09-02T12:00:00Z',
  },
]

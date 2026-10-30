import type { DirectoryEntryLike, FileEntryLike } from '@/shared/lib/fileDrop'

// CLAUDE.md §6.3/§7.4: lee el contenido de las carpetas soltadas o elegidas para
// subirlas. Lógica sin React ni red (la API de archivos y carpetas del navegador
// se inyecta como entradas) para poder testearla directamente (§9).

/** Un archivo y las carpetas que lo contienen, de fuera adentro: `["Fotos", "2024"]`. Vacío = suelto, sin carpeta. */
export type TreeFile = { file: File; dirs: string[] }

export type ScanResult = {
  files: TreeFile[]
  /** Entradas (archivos o carpetas enteras) que el navegador no dejó leer — permisos, enlaces rotos... */
  unreadable: number
  /** Se pararon las lecturas al superar `scanLimit`: `files` está incompleto y no debe usarse. */
  exceededScanLimit: boolean
}

/**
 * Tope de archivos que se leen de una carpeta antes de rendirse. No es el límite
 * de lo que se sube (`MAX_FOLDER_UPLOAD_FILES`, treeUpload.ts, que cuenta solo lo
 * que realmente se encola): es una salvaguarda para que soltar algo como un
 * `node_modules` (cientos de miles de archivos) no se quede minutos leyendo ni
 * llenando memoria antes de poder avisar.
 */
export const MAX_FOLDER_SCAN_FILES = 5000

type Entry = { isFile: boolean; isDirectory: boolean; name: string }

/** `readEntries` entrega las entradas por tandas: se repite hasta recibir una vacía. */
function readAllEntries(directory: DirectoryEntryLike): Promise<Entry[]> {
  const reader = directory.createReader()
  return new Promise((resolve, reject) => {
    const all: Entry[] = []
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(all)
          return
        }
        all.push(...batch)
        readBatch()
      }, reject)
    }
    readBatch()
  })
}

function readFile(entry: FileEntryLike): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject))
}

/**
 * Recorre las carpetas dadas y devuelve todos sus archivos con su ruta. Cada
 * carpeta raíz soltada se conserva como primer segmento (soltar "Fotos" crea
 * "Fotos" dentro del destino, como en el Explorador). Un fallo al leer una
 * entrada no aborta el resto: se cuenta en `unreadable` para avisar al usuario.
 */
export async function readDirectoryTrees(
  directories: DirectoryEntryLike[],
  scanLimit: number = MAX_FOLDER_SCAN_FILES,
): Promise<ScanResult> {
  const files: TreeFile[] = []
  let unreadable = 0
  let exceededScanLimit = false

  const walk = async (directory: DirectoryEntryLike, parents: string[]): Promise<void> => {
    const path = [...parents, directory.name]

    let entries: Entry[]
    try {
      entries = await readAllEntries(directory)
    } catch {
      unreadable += 1
      return
    }

    const fileEntries = entries.filter((entry) => entry.isFile)
    if (files.length + fileEntries.length > scanLimit) {
      exceededScanLimit = true
      return
    }

    // Los archivos de una misma carpeta se resuelven a la vez (cada `file()` es
    // una ida y vuelta al navegador); las subcarpetas, de una en una.
    const read = await Promise.all(
      fileEntries.map(async (entry) => {
        try {
          return await readFile(entry as FileEntryLike)
        } catch {
          return null
        }
      }),
    )
    for (const file of read) {
      if (file) files.push({ file, dirs: path })
      else unreadable += 1
    }

    for (const entry of entries) {
      if (!entry.isDirectory) continue
      await walk(entry as DirectoryEntryLike, path)
      if (exceededScanLimit) return
    }
  }

  for (const directory of directories) {
    await walk(directory, [])
    if (exceededScanLimit) break
  }
  return { files, unreadable, exceededScanLimit }
}

/**
 * Archivos elegidos con `<input webkitdirectory>`: el navegador da la ruta
 * relativa de cada uno (`"Fotos/2024/a.jpg"`, con la carpeta elegida como primer
 * segmento) en `webkitRelativePath`. En un navegador que ignora el atributo
 * (p. ej. Chrome en Android) llega vacía y los archivos se tratan como sueltos.
 */
export function treeFilesFromRelativePaths(files: File[]): TreeFile[] {
  return files.map((file) => {
    const segments = file.webkitRelativePath
      ? file.webkitRelativePath.split('/').filter(Boolean)
      : []
    return { file, dirs: segments.slice(0, -1) }
  })
}

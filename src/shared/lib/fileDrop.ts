// CLAUDE.md §6.3/§11: utilidades puras para arrastrar y pegar archivos. Viven
// aparte del hook (`useFileDropZone`) para poder testearlas sin DOM ni React.

// Subconjunto de la API de archivos y carpetas del navegador (`FileSystemEntry`,
// no estándar pero soportado por todos los navegadores actuales: Chromium,
// Firefox y Safari). Se tipa a mano, igual que `DataTransferLike`, para poder
// pasar dobles en los tests; los `FileSystemEntry` reales encajan estructuralmente.
type EntryBase = { isFile: boolean; isDirectory: boolean; name: string }

export type FileEntryLike = EntryBase & {
  file: (onSuccess: (file: File) => void, onError: (error: unknown) => void) => void
}

export type DirectoryReaderLike = {
  // Devuelve las entradas por tandas (Chromium: como mucho 100 por llamada) y un
  // array vacío al terminar: hay que llamar hasta recibir ese array vacío.
  readEntries: (onSuccess: (entries: EntryBase[]) => void, onError: (error: unknown) => void) => void
}

export type DirectoryEntryLike = EntryBase & {
  createReader: () => DirectoryReaderLike
}

type ItemLike = {
  kind: string
  getAsFile: () => File | null
  // Es la única forma de distinguir una carpeta de un archivo: una carpeta soltada
  // llega como un `File` fantasma de tamaño 0 en `getAsFile()`.
  webkitGetAsEntry?: () => EntryBase | null
}

/** Subconjunto de `DataTransfer` que usamos — permite pasar un doble en los tests. */
export type DataTransferLike = {
  files: ArrayLike<File>
  items?: ArrayLike<ItemLike>
}

/** ¿El arrastre lleva archivos del sistema (y no texto, un enlace o un elemento de la propia página)? */
export function dataTransferHasFiles(dataTransfer: { types: ArrayLike<string> } | null | undefined): boolean {
  if (!dataTransfer) return false
  return Array.from(dataTransfer.types).includes('Files')
}

export type DroppedItems = {
  files: File[]
  /** Carpetas soltadas: su contenido se lee aparte y de forma asíncrona (`readDirectoryTrees`). */
  directories: DirectoryEntryLike[]
}

/**
 * Saca los archivos y las carpetas de un `DataTransfer` (soltar o pegar). Hay que
 * llamarla SINCRÓNICAMENTE dentro del evento: el navegador invalida `items` en
 * cuanto el manejador termina. Las entradas de carpeta que devuelve sí siguen
 * siendo válidas después, así que su contenido se puede leer más tarde.
 */
export function extractDroppedItems(dataTransfer: DataTransferLike): DroppedItems {
  const items = dataTransfer.items ? Array.from(dataTransfer.items) : []
  if (items.length === 0) {
    return { files: Array.from(dataTransfer.files), directories: [] }
  }

  const files: File[] = []
  const directories: DirectoryEntryLike[] = []
  for (const item of items) {
    if (item.kind !== 'file') continue
    const entry = item.webkitGetAsEntry?.()
    if (entry?.isDirectory) {
      directories.push(entry as DirectoryEntryLike)
      continue
    }
    const file = item.getAsFile()
    if (file) files.push(file)
  }
  return { files, directories }
}

// Los navegadores nombran "image.png" a toda imagen pegada del portapapeles
// (una captura de pantalla, una imagen copiada de una web...): pegar dos veces
// daría dos archivos idénticos en la carpeta.
const GENERIC_CLIPBOARD_NAME = /^image(\.[A-Za-z0-9]+)?$/

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Da un nombre con fecha y hora a las imágenes pegadas con nombre genérico; el resto, intactas. */
export function nameForPastedFile(file: File, now: Date = new Date()): File {
  const match = GENERIC_CLIPBOARD_NAME.exec(file.name)
  if (!match) return file
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`
  return new File([file], `Captura ${stamp}${match[1] ?? ''}`, { type: file.type, lastModified: file.lastModified })
}

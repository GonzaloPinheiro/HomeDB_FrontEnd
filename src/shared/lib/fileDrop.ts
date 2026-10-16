// CLAUDE.md §6.3/§11: utilidades puras para arrastrar y pegar archivos. Viven
// aparte del hook (`useFileDropZone`) para poder testearlas sin DOM ni React.

type EntryLike = { isDirectory: boolean }

type ItemLike = {
  kind: string
  getAsFile: () => File | null
  // No estándar pero soportado por todos los navegadores actuales (Chromium,
  // Firefox, Safari). Es la única forma de distinguir una carpeta de un archivo.
  webkitGetAsEntry?: () => EntryLike | null
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

export type ExtractedFiles = {
  files: File[]
  /** Carpetas encontradas entre lo soltado: no se pueden subir (aún no hay subida recursiva). */
  directoryCount: number
}

/**
 * Saca los archivos de un `DataTransfer` (soltar o pegar) separando las
 * carpetas. Hay que llamarla SINCRÓNICAMENTE dentro del evento: el navegador
 * invalida `items` en cuanto el manejador termina.
 *
 * Sin esta distinción, una carpeta soltada llega como un `File` fantasma de
 * tamaño 0 que el backend rechaza con un error confuso.
 */
export function extractFiles(dataTransfer: DataTransferLike): ExtractedFiles {
  const items = dataTransfer.items ? Array.from(dataTransfer.items) : []
  if (items.length === 0) {
    return { files: Array.from(dataTransfer.files), directoryCount: 0 }
  }

  const files: File[] = []
  let directoryCount = 0
  for (const item of items) {
    if (item.kind !== 'file') continue
    if (item.webkitGetAsEntry?.()?.isDirectory) {
      directoryCount += 1
      continue
    }
    const file = item.getAsFile()
    if (file) files.push(file)
  }
  return { files, directoryCount }
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

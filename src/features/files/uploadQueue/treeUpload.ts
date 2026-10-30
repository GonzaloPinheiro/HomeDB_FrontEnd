import { formatInteger } from '@/shared/lib/formatNumber'

import { FOLDER_NAME_MAX_LENGTH } from '../schemas'
import { isAllowedExtension, rejectedExtensionsMessage } from './allowedExtensions'
import { MAX_FOLDER_SCAN_FILES, type TreeFile } from './directoryTree'

// CLAUDE.md §7.4: reglas de qué se encola al subir archivos o una carpeta. Lógica
// pura (sin React ni red), testeada en treeUpload.test.ts (§9).

/**
 * Tope de archivos que se encolan al subir una carpeta (los que de verdad se
 * subirían, no los que se descartan). Cada archivo es una fila de la cola y cuesta
 * unas 4 peticiones del rate limit global (500/min, compartido con toda la app):
 * un árbol enorme saturaría la cola y la lista del panel. Para algo mayor se sube
 * por partes. Es un solo número: subirlo o bajarlo es tocar solo este valor.
 */
export const MAX_FOLDER_UPLOAD_FILES = 500

// Basura que el sistema operativo mete en las carpetas y que el usuario no eligió
// ni sabe que existe: sin esto, toda carpeta de un Mac avisaría de que ".DS_Store"
// es un tipo no admitido. Solo se ignora dentro de carpetas — un archivo suelto
// que el usuario eligió expresamente sí se evalúa como cualquier otro.
const OS_JUNK_FILE_NAMES: ReadonlySet<string> = new Set(['.ds_store', 'thumbs.db', 'desktop.ini'])

/**
 * Mismas reglas que el formulario de "Nueva carpeta" (`folderNameSchema`): el
 * backend no valida el nombre de una carpeta (verificado octubre 2026), así que
 * esta es la única barrera.
 */
export function isValidFolderName(name: string): boolean {
  return name.trim().length > 0 && name.length <= FOLDER_NAME_MAX_LENGTH && !name.includes('/')
}

export type TreeUploadPlan = {
  /** Lo que se encola. */
  accepted: TreeFile[]
  /** Nombres de los archivos rechazados por su extensión (allowedExtensions.ts). */
  rejectedExtensions: string[]
  /** El backend rechaza `totalSizeBytes <= 0` en `init` (`InvalidUploadRequest`): no tiene sentido ni intentarlo. */
  emptyFiles: number
  /** Archivos dentro de una carpeta con nombre no válido: no se puede crear esa carpeta. */
  invalidFolderNameFiles: number
}

/** Decide qué archivos se encolan y cuáles se descartan, y por qué. El orden se conserva. */
export function planTreeUpload(items: TreeFile[]): TreeUploadPlan {
  const plan: TreeUploadPlan = {
    accepted: [],
    rejectedExtensions: [],
    emptyFiles: 0,
    invalidFolderNameFiles: 0,
  }

  for (const item of items) {
    const { file, dirs } = item
    if (dirs.length > 0 && OS_JUNK_FILE_NAMES.has(file.name.toLowerCase())) continue
    if (!dirs.every(isValidFolderName)) {
      plan.invalidFolderNameFiles += 1
    } else if (file.size === 0) {
      plan.emptyFiles += 1
    } else if (!isAllowedExtension(file.name)) {
      plan.rejectedExtensions.push(file.name)
    } else {
      plan.accepted.push(item)
    }
  }
  return plan
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm
}

/** Un aviso por cada motivo por el que se descartaron archivos (vacío si no se descartó ninguno). */
export function describeSkippedFiles(plan: TreeUploadPlan): string[] {
  const messages: string[] = []

  const extensions = rejectedExtensionsMessage(plan.rejectedExtensions)
  if (extensions) messages.push(extensions)

  if (plan.emptyFiles > 0) {
    messages.push(
      `${plan.emptyFiles} ${plural(plan.emptyFiles, 'archivo vacío omitido', 'archivos vacíos omitidos')}: el servidor no admite archivos de 0 bytes`,
    )
  }

  if (plan.invalidFolderNameFiles > 0) {
    messages.push(
      `${plan.invalidFolderNameFiles} ${plural(plan.invalidFolderNameFiles, 'archivo omitido', 'archivos omitidos')}: ` +
        `${plural(plan.invalidFolderNameFiles, 'está', 'están')} en una carpeta con nombre vacío o de más de ${FOLDER_NAME_MAX_LENGTH} caracteres`,
    )
  }
  return messages
}

export function unreadableMessage(count: number): string {
  return `${count} ${plural(count, 'elemento no se pudo leer y se ha omitido', 'elementos no se pudieron leer y se han omitido')}`
}

export function tooManyFilesMessage(count: number): string {
  return (
    `La carpeta tiene ${formatInteger(count)} archivos para subir y el máximo por subida es ` +
    `${formatInteger(MAX_FOLDER_UPLOAD_FILES)}. Súbela por partes.`
  )
}

export function scanLimitMessage(): string {
  return `La carpeta tiene demasiados archivos (más de ${formatInteger(MAX_FOLDER_SCAN_FILES)}). Elige una más pequeña o súbela por partes.`
}

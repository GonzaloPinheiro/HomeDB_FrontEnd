import { z } from 'zod'

// CLAUDE.md §7.6: schemas de formularios junto a la feature.
// Compartido con la subida de carpetas (uploadQueue/treeUpload.ts): una carpeta
// subida se rige por la misma regla que una creada a mano.
export const FOLDER_NAME_MAX_LENGTH = 100

// Es un nombre de visualización, no una ruta — por eso se rechaza "/".
export const folderNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Escribe un nombre')
    .max(FOLDER_NAME_MAX_LENGTH, `Máximo ${FOLDER_NAME_MAX_LENGTH} caracteres`)
    .refine((value) => !value.includes('/'), 'El nombre no puede contener "/"'),
})

export type FolderNameValues = z.infer<typeof folderNameSchema>

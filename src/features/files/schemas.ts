import { z } from 'zod'

// CLAUDE.md §7.6: schemas de formularios junto a la feature.
// Es un nombre de visualización, no una ruta — por eso se rechaza "/".
export const folderNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Escribe un nombre')
    .max(100, 'Máximo 100 caracteres')
    .refine((value) => !value.includes('/'), 'El nombre no puede contener "/"'),
})

export type FolderNameValues = z.infer<typeof folderNameSchema>

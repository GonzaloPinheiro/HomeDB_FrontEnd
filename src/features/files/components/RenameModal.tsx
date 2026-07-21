import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Modal } from '@/shared/components/Modal'
import { Button } from '@/shared/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'

import { useRenameFile, useRenameFolder } from '../api'
import { folderNameSchema, type FolderNameValues } from '../schemas'
import type { ExplorerItem } from '../types'

type RenameModalProps = {
  open: boolean
  onClose: () => void
  parentFolderId: number | null
  item: ExplorerItem
}

// CLAUDE.md §6.4: renombrar — modal pequeño. Carpetas usan PATCH /folders;
// archivos van por useRenameFile (§7.5: detrás de FILE_MOVE_ENABLED mientras
// PATCH /files/{id} no exista en el backend).
export function RenameModal({ open, onClose, parentFolderId, item }: RenameModalProps) {
  const renameFolder = useRenameFolder(parentFolderId)
  const renameFile = useRenameFile(parentFolderId)
  const isPending = renameFolder.isPending || renameFile.isPending
  const inputRef = useRef<HTMLInputElement | null>(null)
  const form = useForm<FolderNameValues>({
    resolver: zodResolver(folderNameSchema),
    values: { name: item.name },
  })

  // CLAUDE.md §11: un archivo preselecciona el nombre SIN la extensión (como
  // Explorer/Finder); una carpeta, el nombre completo.
  useEffect(() => {
    if (!open) return
    const input = inputRef.current
    if (!input) return
    const dotIndex = item.kind === 'file' ? item.name.lastIndexOf('.') : -1
    const end = dotIndex > 0 ? dotIndex : item.name.length
    requestAnimationFrame(() => input.setSelectionRange(0, end))
  }, [open, item])

  const close = () => {
    form.reset()
    onClose()
  }

  const submit = form.handleSubmit((values) => {
    if (item.kind === 'folder') {
      renameFolder.mutate(
        { folderId: item.id, newName: values.name },
        {
          onSuccess: () => {
            toast.success('Carpeta renombrada')
            close()
          },
        },
      )
    } else {
      // Con FILE_MOVE_ENABLED=false termina en el toast informativo del hook
      renameFile.mutate({ fileId: item.id, newName: values.name }, { onSuccess: close })
    }
  })

  return (
    <Modal open={open} onOpenChange={(value) => !value && close()} title="Renombrar" size="small">
      <Form {...form}>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nuevo nombre</FormLabel>
                <FormControl>
                  <Input
                    autoFocus
                    {...field}
                    ref={(element) => {
                      field.ref(element)
                      inputRef.current = element
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : null}
              Guardar
            </Button>
          </div>
        </form>
      </Form>
    </Modal>
  )
}

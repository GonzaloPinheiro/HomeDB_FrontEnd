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

import { useRenameFolder } from '../api'
import { folderNameSchema, type FolderNameValues } from '../schemas'
import type { ExplorerItem } from '../types'

type RenameModalProps = {
  open: boolean
  onClose: () => void
  parentFolderId: number | null
  /**
   * Hoy solo llegan carpetas: no existe endpoint para renombrar archivos
   * (verificado julio 2026 — FilesController no tiene PATCH). El modal ya
   * contempla ambos tipos para cuando exista: con un archivo preseleccionaría
   * el nombre sin la extensión (§11).
   */
  item: ExplorerItem
}

export function RenameModal({ open, onClose, parentFolderId, item }: RenameModalProps) {
  const mutation = useRenameFolder(parentFolderId)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const form = useForm<FolderNameValues>({
    resolver: zodResolver(folderNameSchema),
    values: { name: item.name },
  })

  // CLAUDE.md §11: al renombrar un archivo se preselecciona el nombre SIN la
  // extensión (como Explorer/Finder); una carpeta, el nombre completo.
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
    if (item.kind !== 'folder') return // PENDIENTE (CLAUDE.md §5.4): sin endpoint de renombrar archivos
    mutation.mutate(
      { folderId: item.id, newName: values.name },
      {
        onSuccess: () => {
          toast.success('Carpeta renombrada')
          close()
        },
      },
    )
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
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              Guardar
            </Button>
          </div>
        </form>
      </Form>
    </Modal>
  )
}

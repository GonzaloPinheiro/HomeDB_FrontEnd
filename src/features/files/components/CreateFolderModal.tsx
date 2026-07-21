import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
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

import { useCreateFolder } from '../api'
import { folderNameSchema, type FolderNameValues } from '../schemas'

type CreateFolderModalProps = {
  open: boolean
  onClose: () => void
  parentFolderId: number | null
}

// CLAUDE.md §6.4: crear carpeta — modal pequeño, input simple + Cancelar/Guardar
export function CreateFolderModal({ open, onClose, parentFolderId }: CreateFolderModalProps) {
  const mutation = useCreateFolder(parentFolderId)
  const form = useForm<FolderNameValues>({
    resolver: zodResolver(folderNameSchema),
    defaultValues: { name: '' },
  })

  const close = () => {
    form.reset()
    onClose()
  }

  const submit = form.handleSubmit((values) => {
    mutation.mutate(values.name, {
      onSuccess: (folder) => {
        toast.success(`Carpeta "${folder.name}" creada`)
        close()
      },
    })
  })

  return (
    <Modal open={open} onOpenChange={(value) => !value && close()} title="Nueva carpeta" size="small">
      <Form {...form}>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input autoFocus {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
            {/* CLAUDE.md §11: deshabilitado + carga mientras la mutation está en curso */}
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

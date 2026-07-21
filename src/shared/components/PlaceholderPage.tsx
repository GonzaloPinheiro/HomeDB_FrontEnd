import { Construction } from 'lucide-react'

import { EmptyState } from '@/shared/components/EmptyState'

type PlaceholderPageProps = {
  title: string
  description: string
}

// PENDIENTE (Fase 1): página provisional de los módulos aún no construidos.
// Cada feature la sustituirá por su pantalla real en su fase correspondiente.
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex min-h-full flex-col p-6">
      <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
      <div className="flex flex-1 items-center justify-center">
        <EmptyState icon={Construction} title={`${title} — en construcción`} description={description} />
      </div>
    </div>
  )
}

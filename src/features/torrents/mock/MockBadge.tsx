import { Badge } from '@/shared/components/ui/badge'

// CLAUDE.md §6.19: marca visible de que la pantalla muestra datos de ejemplo, para
// que nadie los confunda con torrents reales. Se retira con el resto de `mock/`.
export function MockBadge() {
  return (
    <Badge
      variant="secondary"
      className="border-border font-medium"
      title="Datos de ejemplo: el backend todavía no tiene torrents"
    >
      Maqueta
    </Badge>
  )
}

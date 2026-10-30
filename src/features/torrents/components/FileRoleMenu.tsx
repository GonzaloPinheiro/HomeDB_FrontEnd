import { ChevronDown } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { cn } from '@/shared/lib/utils'

import { FILE_ROLE_HINTS, FILE_ROLE_LABELS, LANGUAGE_LABELS, languageLabel } from '../labels'
import type { FileRole, TorrentFile } from '../types'

// Orden del menú: los cuatro usos, y «No descargar» aparte, al final (§6.19)
const USE_ROLES: FileRole[] = ['mainVideo', 'subtitle', 'alternateAudio', 'extra']

function pillClassName(role: FileRole): string {
  if (role === 'mainVideo') return 'bg-accent-tint-bg text-accent-tint-text'
  if (role === 'skip') return 'border border-dashed border-text-faint text-text-muted'
  // Neutro: `bg-surface` + borde; `bg-surface-alt` se confunde con la tarjeta en oscuro (§6.1)
  return 'border border-border-light bg-surface text-text-secondary'
}

function RoleItem({ role }: { role: FileRole }) {
  const hint = FILE_ROLE_HINTS[role]
  return (
    <DropdownMenuRadioItem value={role}>
      {FILE_ROLE_LABELS[role]}
      {hint && <span className="ml-auto pl-4 text-xs text-text-muted">{hint}</span>}
    </DropdownMenuRadioItem>
  )
}

// CLAUDE.md §6.19: selector del rol de un fichero (vídeo principal, subtítulo con
// idioma, audio alternativo, extra o no descargar). Radix lleva el teclado, el foco
// y la accesibilidad. El idioma solo existe para subtítulos: va en un submenú.
// PENDIENTE (CLAUDE.md §6.19): maqueta — los grupos son controlados y no tienen
// `onValueChange`, así que elegir una opción cierra el menú sin cambiar nada. Con
// backend, el cambio se guardará en un borrador local que "Guardar" enviará de una vez.
export function FileRoleMenu({ file, role }: { file: TorrentFile; role: FileRole }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Rol de ${file.name}: ${FILE_ROLE_LABELS[role]}`}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            pillClassName(role),
          )}
        >
          {FILE_ROLE_LABELS[role]}
          {role === 'subtitle' && file.language && (
            <span className="font-normal">· {languageLabel(file.language)}</span>
          )}
          <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[13rem]">
        <DropdownMenuRadioGroup value={role}>
          {USE_ROLES.map((use) => (
            <RoleItem key={use} role={use} />
          ))}
          {role === 'subtitle' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  Idioma
                  <span className="ml-auto pl-4 text-xs text-text-muted">
                    {file.language ? languageLabel(file.language) : 'Sin definir'}
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={file.language ?? ''}>
                    {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
                      <DropdownMenuRadioItem key={code} value={code}>
                        {label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}
          <DropdownMenuSeparator />
          <RoleItem role="skip" />
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

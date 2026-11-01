import { cn } from '@/shared/lib/utils'

export type SegmentedOption<T extends string> = {
  value: T
  label: string
  /** Recuento opcional junto a la etiqueta (p. ej. "Activos 3"). */
  count?: number
}

type SegmentedControlProps<T extends string> = {
  value: T
  options: ReadonlyArray<SegmentedOption<T>>
  onChange: (value: T) => void
  'aria-label': string
}

// Mismo aspecto que los chips de rango del Monitor (§6.13): grupo con borde, opción activa en
// acento. Con poco ancho (móvil) hace scroll horizontal en vez de recortarse, igual que la
// tira de categorías de Torrents (§6.19). Compartido por AdGuard (§6.21) y VPN (§6.22).
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      className="max-w-full overflow-x-auto rounded-lg border border-border bg-surface p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label={ariaLabel}
    >
      <div className="flex w-max gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value === option.value
                ? 'bg-accent text-text-on-accent'
                : 'text-text-secondary hover:bg-row-hover hover:text-text-primary',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={cn('ml-1.5 text-xs font-normal', value === option.value ? 'opacity-80' : 'text-text-muted')}>
                {option.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

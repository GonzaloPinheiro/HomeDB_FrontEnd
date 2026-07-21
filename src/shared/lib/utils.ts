import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Helper estándar de shadcn/ui (CLAUDE.md §4): combina clases condicionales y
// resuelve conflictos de utilidades de Tailwind.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

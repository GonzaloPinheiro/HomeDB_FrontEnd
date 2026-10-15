import animatePlugin from 'tailwindcss-animate'
import type { Config } from 'tailwindcss'

// CLAUDE.md §6.1: los colores referencian siempre las CSS variables de
// src/styles/globals.css — nunca valores hexadecimales hardcodeados aquí.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Tarjeta "flotante" de la pantalla de Inicio (§6.18): sombra suave de dos
      // capas derivada de --text-primary, para que funcione en claro y oscuro
      boxShadow: {
        float:
          '0 2px 3px color-mix(in srgb, var(--text-primary) 5%, transparent), 0 18px 32px -20px color-mix(in srgb, var(--text-primary) 40%, transparent)',
      },
      colors: {
        bg: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          alt: 'var(--surface-alt)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--text-primary)',
        },
        border: {
          DEFAULT: 'var(--border)',
          light: 'var(--border-light)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          'muted-2': 'var(--text-muted-2)',
          faint: 'var(--text-faint)',
          'on-accent': 'var(--text-on-accent)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          'tint-bg': 'var(--accent-tint-bg)',
          'tint-text': 'var(--accent-tint-text)',
        },
        // Sombreado de fila al pasar el ratón (§6.1): translúcido, visible sobre el degradado de AppShell
        'row-hover': 'var(--row-hover)',
        // Cabecera superior oscura en ambos temas (§6.1)
        header: {
          DEFAULT: 'var(--header-bg)',
          surface: 'var(--header-surface)',
          border: 'var(--header-border)',
          text: 'var(--header-text)',
          muted: 'var(--header-muted)',
        },
        warning: {
          bg: 'var(--warning-bg)',
          text: 'var(--warning-text)',
        },
        critical: {
          bg: 'var(--critical-bg)',
          text: 'var(--critical-text)',
        },
        positive: {
          bg: 'var(--positive-bg)',
          text: 'var(--positive-text)',
        },
        // Alias semánticos que esperan los componentes de shadcn/ui — mapean a las
        // mismas CSS variables de §6.1, nunca a valores nuevos.
        background: 'var(--bg)',
        foreground: 'var(--text-primary)',
        input: 'var(--border)',
        ring: 'var(--accent)',
        primary: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--text-on-accent)',
        },
        secondary: {
          DEFAULT: 'var(--surface)',
          foreground: 'var(--text-primary)',
        },
        muted: {
          DEFAULT: 'var(--surface)',
          foreground: 'var(--text-secondary)',
        },
        popover: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--text-primary)',
        },
        destructive: {
          DEFAULT: 'var(--critical-text)',
          foreground: 'var(--critical-bg)',
        },
      },
    },
  },
  // CLAUDE.md §3: tailwindcss-animate para las transiciones de apertura/cierre
  // de los componentes Radix de shadcn (dialog, dropdown...)
  plugins: [animatePlugin],
} satisfies Config

import type { Config } from 'tailwindcss'

// CLAUDE.md §6.1: los colores referencian siempre las CSS variables de
// src/styles/globals.css — nunca valores hexadecimales hardcodeados aquí.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
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
        warning: {
          bg: 'var(--warning-bg)',
          text: 'var(--warning-text)',
        },
        critical: {
          bg: 'var(--critical-bg)',
          text: 'var(--critical-text)',
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
  plugins: [],
} satisfies Config

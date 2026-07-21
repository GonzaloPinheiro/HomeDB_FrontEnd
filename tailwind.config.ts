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
        card: 'var(--card)',
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
      },
    },
  },
  plugins: [],
} satisfies Config

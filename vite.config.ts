/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    // CLAUDE.md §7.7: shared/env.ts valida VITE_API_URL al importarse, y casi
    // todos los módulos de red lo importan. Sin este valor, los tests dependen
    // de que exista un .env local (en un clon limpio o en CI fallan 13 suites).
    env: { VITE_API_URL: 'http://localhost:5000' },
  },
})

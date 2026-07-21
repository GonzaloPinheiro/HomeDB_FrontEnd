import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './app/App'
import './shared/env' // CLAUDE.md §7.7: valida el entorno al arrancar (fail-fast)
import { applyTheme } from './shared/lib/theme'
import './styles/globals.css'

// CLAUDE.md §6.1: aplica el tema (override de localStorage o prefers-color-scheme)
applyTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

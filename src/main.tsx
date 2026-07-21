import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './app/App'
import './shared/env' // CLAUDE.md §7.7: valida el entorno al arrancar (fail-fast)
import './styles/globals.css'

// CLAUDE.md §6.1: prefers-color-scheme por defecto, con override manual guardado
// solo en el dispositivo. El toggle de UI que escribe 'theme' llega en fases
// posteriores; esto deja los dos temas ya operativos para verificarlos.
const storedTheme = localStorage.getItem('theme')
const isDark =
  storedTheme !== null
    ? storedTheme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches
document.documentElement.classList.toggle('dark', isDark)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'

import { PageSkeleton } from '@/shared/components/PageSkeleton'
import { env } from '@/shared/env'
import { useAuth } from '@/shared/hooks/useAuth'

import { LoginForm } from './LoginForm'
import { LoginShowcase } from './LoginShowcase'
import { LINK_BUTTON_CLASS, notAvailableYet } from './loginShared'
import { RecoverPasswordForm } from './RecoverPasswordForm'

// Host del servidor al que apunta el front (el que muestra la píldora de la esquina)
const SERVER_HOST = new URL(env.VITE_API_URL).host

type View = 'login' | 'recover'

// CLAUDE.md §6.17: el lado derecho tiene dos vistas que se sustituyen en el mismo hueco
// —identificarse y recuperar la contraseña— sin tocar el panel de la izquierda ni el
// marco (servidor, degradado, pie). Los formularios viven en LoginForm y
// RecoverPasswordForm; aquí solo está el marco y qué vista toca.
export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const [view, setView] = useState<View>('login')

  if (isLoading) return <PageSkeleton />
  if (isAuthenticated) return <Navigate to="/" replace />

  return (
    <main className="flex min-h-screen bg-surface-alt">
      <LoginShowcase />

      {/* Columna fija pegada a la derecha desde xl: el diseño de la izquierda se queda con el resto del ancho */}
      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden border-l border-border bg-bg px-6 py-10 sm:px-[54px] xl:w-[680px] xl:flex-none">
        <div
          className="absolute right-0 top-0 h-[260px] w-[260px]"
          style={{ backgroundImage: 'linear-gradient(200deg, var(--surface), transparent 70%)' }}
          aria-hidden
        />

        {/* Estado del servidor: el punto es decorativo por ahora (no hay comprobación de salud real) */}
        <div className="relative flex items-center gap-[9px] self-end rounded-full border border-border bg-card px-3 py-[7px] text-xs text-text-secondary">
          <span className="h-[7px] w-[7px] rounded-full bg-positive-text" aria-hidden />
          <span className="font-mono">{SERVER_HOST}</span>
        </div>

        {/* §6.1: transición corta (fade + deslizamiento sutil, sin rebote). `reducedMotion="user"`
            quita el deslizamiento a quien lo pide en su sistema. `mode="wait"`: la vista que
            sale termina antes de entrar la nueva, así nunca hay dos formularios a la vez. */}
        <MotionConfig reducedMotion="user">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="relative mx-auto my-auto flex w-full max-w-[400px] flex-col gap-[26px] py-8 xl:mx-0"
            >
              {view === 'login' ? (
                <LoginForm onForgotPassword={() => setView('recover')} />
              ) : (
                <RecoverPasswordForm onBack={() => setView('login')} />
              )}
            </motion.div>
          </AnimatePresence>
        </MotionConfig>

        <div className="relative flex flex-col gap-2 text-xs text-text-muted">
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between gap-4">
            <span>HomeDB · instancia privada</span>
            <button type="button" onClick={() => notAvailableYet()} className={LINK_BUTTON_CLASS}>
              Otro servidor
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { api, setOnSessionExpired, toApiError, unwrap } from '@/shared/api/client'
import { decodeJwtClaims, type AuthClaims } from '@/shared/lib/jwt'
import type { ApiObjResponse } from '@/shared/types/api'

// Forma real de TokenResponseDto (HomeDB.Application/DTOs/Auth/AuthDtos.cs),
// serializado en camelCase. El refreshToken del body se ignora (§5.2: la cookie
// httpOnly es la única fuente de verdad).
const tokenResponseSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.string(),
  refreshToken: z.string(),
  refreshTokenExpiresAt: z.string(),
})

type AuthContextValue = {
  /** Claims del access token, solo para pintar la UI (§5.2). */
  claims: AuthClaims | null
  isAuthenticated: boolean
  /** true mientras se comprueba la sesión al arrancar (refresh con la cookie). */
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // CLAUDE.md §7.2: el access token vive solo en memoria (nunca localStorage);
  // aquí basta con conservar los claims decodificados, el token en sí no se
  // usa para nada más.
  const [claims, setClaims] = useState<AuthClaims | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  const applyToken = useCallback((accessToken: string) => {
    setClaims(decodeJwtClaims(accessToken))
  }, [])

  const clearSession = useCallback(() => {
    setClaims(null)
  }, [])

  // Restauración de sesión al montar: la cookie RefreshToken viaja sola. Fallar
  // aquí es lo normal sin sesión previa — sin toast de error.
  useEffect(() => {
    let cancelled = false
    api
      .post<ApiObjResponse<unknown>>('/auth/refreshToken', { refreshToken: '' })
      .then((response) => {
        if (cancelled) return
        const tokens = tokenResponseSchema.parse(unwrap(response.data))
        applyToken(tokens.accessToken)
      })
      .catch(() => {
        /* sin sesión previa: estado no autenticado, silencioso */
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [applyToken])

  // El interceptor de client.ts avisa aquí cuando el refresh automático falla:
  // limpiar estado y navegar a /login con el router (§5.2).
  useEffect(() => {
    setOnSessionExpired(() => {
      clearSession()
      navigate('/login')
    })
    return () => setOnSessionExpired(null)
  }, [clearSession, navigate])

  const login = useCallback(
    async (username: string, password: string) => {
      try {
        const response = await api.post<ApiObjResponse<unknown>>('/auth/login', {
          username,
          password,
        })
        const tokens = tokenResponseSchema.parse(unwrap(response.data))
        applyToken(tokens.accessToken)
      } catch (error) {
        // Se propaga tipado para que el formulario de login lo muestre
        throw toApiError(error)
      }
    },
    [applyToken],
  )

  const logout = useCallback(async () => {
    try {
      // §5.2: responde 200 aunque el token ya no exista — el resultado da igual
      await api.post('/auth/logout', { refreshToken: '' })
    } catch {
      /* ignorado a propósito */
    }
    clearSession()
    navigate('/login')
  }, [clearSession, navigate])

  const value = useMemo<AuthContextValue>(
    () => ({
      claims,
      isAuthenticated: claims !== null,
      isLoading,
      login,
      logout,
    }),
    [claims, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return context
}

'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  type AuthSession,
  clearSession,
  getStoredSession,
  normalizarSesion,
  sessionToLegacyUser,
  storeSession,
} from '@/lib/portalAuthService'

interface AuthContextType {
  session: AuthSession | null
  user: {
    usuario_id: number
    usuario_username: string
    usuario_nombre_completo: string
  } | null
  loading: boolean
  login: (session: AuthSession) => void
  logout: () => void
  isAuthenticated: boolean
  isAlumno: boolean
  isUsuario: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const guardada = getStoredSession()
    if (!guardada) {
      setLoading(false)
      return
    }
    // La cookie firmada manda: sin ella (sesión vieja o vencida) las APIs responden 401.
    let vivo = true
    void fetch('/api/auth/sesion', { cache: 'no-store' })
      .then(async (res) => {
        if (!vivo) return
        if (res.status === 401) {
          clearSession()
          setSession(null)
          return
        }
        const body = (await res.json().catch(() => ({}))) as { session?: unknown }
        const firmada = res.ok ? normalizarSesion(body.session) : null
        if (firmada) storeSession(firmada)
        setSession(firmada ?? guardada)
      })
      .catch(() => {
        if (vivo) setSession(guardada)
      })
      .finally(() => {
        if (vivo) setLoading(false)
      })
    return () => {
      vivo = false
    }
  }, [])

  const login = useCallback((next: AuthSession) => {
    // Nueva sesión siempre reemplaza la anterior (no mezclar alumno/admin).
    clearSession()
    const clean = normalizarSesion(next)
    if (!clean) {
      setSession(null)
      return
    }
    storeSession(clean)
    setSession(clean)
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setSession(null)
    void fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  }, [])

  const user = useMemo(
    () => (session ? sessionToLegacyUser(session) : null),
    [session]
  )

  const isAlumno = session?.role === 'alumno'
  const isUsuario = session?.role === 'usuario'

  const value = useMemo(
    () => ({
      session,
      user,
      loading,
      login,
      logout,
      isAuthenticated: !!session && (isAlumno || isUsuario),
      isAlumno,
      isUsuario,
    }),
    [session, user, loading, login, logout, isAlumno, isUsuario]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

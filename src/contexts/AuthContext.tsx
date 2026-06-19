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
    setSession(getStoredSession())
    setLoading(false)
  }, [])

  const login = useCallback((next: AuthSession) => {
    storeSession(next)
    setSession(next)
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setSession(null)
  }, [])

  const user = useMemo(
    () => (session ? sessionToLegacyUser(session) : null),
    [session]
  )

  const value = useMemo(
    () => ({
      session,
      user,
      loading,
      login,
      logout,
      isAuthenticated: !!session,
      isAlumno: session?.role === 'alumno',
      isUsuario: session?.role === 'usuario',
    }),
    [session, user, loading, login, logout]
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

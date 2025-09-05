'use client'

import React, { createContext, useContext, useState } from 'react'
import { AuthUser } from '@/lib/authService'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  login: (user: AuthUser) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Usuario por defecto para simular autenticación
  const [user] = useState<AuthUser | null>({
    usuario_id: 1,
    usuario_username: 'admin',
    usuario_nombre_completo: 'Administrador del Sistema'
  })
  const [loading] = useState(false)

  const login = (authUser: AuthUser) => {
    // No hacer nada, ya estamos "autenticados"
    console.log('Login llamado:', authUser)
  }

  const logout = () => {
    // No hacer nada, mantener siempre autenticado
    console.log('Logout llamado - manteniendo sesión')
  }

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: true // Siempre autenticado
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

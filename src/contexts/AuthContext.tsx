'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { AuthUser, getStoredUser, storeUser, logoutUser } from '@/lib/authService'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  login: (user: AuthUser) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar si hay un usuario almacenado al cargar
    const storedUser = getStoredUser()
    if (storedUser) {
      setUser(storedUser)
    }
    setLoading(false)
  }, [])

  const login = (authUser: AuthUser) => {
    setUser(authUser)
    storeUser(authUser)
  }

  const logout = () => {
    setUser(null)
    logoutUser()
  }

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user
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

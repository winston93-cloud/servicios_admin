'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { AuthUser, getStoredUser, storeUser, logoutUser, getCurrentUser, getCurrentSession, onAuthStateChange, signOut, getUserByEmail } from '@/lib/authService'
import { User, Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: AuthUser | null
  googleUser: User | null
  session: Session | null
  loading: boolean
  login: (user: AuthUser) => void
  logout: () => void
  isAuthenticated: boolean
  isGoogleAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [googleUser, setGoogleUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar autenticación de Google y sesión actual
    async function checkAuth() {
      try {
        const currentSession = await getCurrentSession()
        const currentUser = await getCurrentUser()
        
        if (currentSession && currentUser) {
          console.log('Sesión de Google activa encontrada:', currentUser.email)
          setSession(currentSession)
          setGoogleUser(currentUser)
          
          // Buscar usuario en la base de datos local
          if (currentUser.email) {
            const localUser = await getUserByEmail(currentUser.email)
            if (localUser) {
              console.log('Usuario local encontrado:', localUser.usuario_nombre_completo)
              setUser(localUser)
            } else {
              console.log('Usuario no encontrado en BD local, usando datos de Google')
              // Crear usuario virtual con datos de Google
              const virtualUser: AuthUser = {
                usuario_id: 0,
                usuario_username: currentUser.email.split('@')[0],
                usuario_nombre_completo: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0],
                email: currentUser.email
              }
              setUser(virtualUser)
            }
          }
        } else {
          console.log('No hay sesión de Google activa')
          // Verificar si hay un usuario almacenado del sistema anterior
          const storedUser = getStoredUser()
          if (storedUser) {
            console.log('Usuario del sistema anterior encontrado:', storedUser.usuario_nombre_completo)
            setUser(storedUser)
          }
        }
      } catch (error) {
        console.error('Error verificando autenticación:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()

    // Escuchar cambios en el estado de autenticación
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      console.log('Evento de autenticación:', event)
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('Usuario firmado en Google:', session.user.email)
        setSession(session)
        setGoogleUser(session.user)
        
        // Buscar o crear usuario en la base de datos local
        if (session.user.email) {
          const localUser = await getUserByEmail(session.user.email)
          if (localUser) {
            setUser(localUser)
          } else {
            // Crear usuario virtual
            const virtualUser: AuthUser = {
              usuario_id: 0,
              usuario_username: session.user.email.split('@')[0],
              usuario_nombre_completo: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
              email: session.user.email
            }
            setUser(virtualUser)
          }
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('Usuario cerrado sesión en Google')
        setSession(null)
        setGoogleUser(null)
        setUser(null)
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token de Google refrescado')
        // Verificar si la sesión sigue siendo válida
        const refreshedSession = await getCurrentSession()
        if (refreshedSession?.user) {
          setSession(refreshedSession)
          setGoogleUser(refreshedSession.user)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Verificar periódicamente si la sesión sigue siendo válida
  useEffect(() => {
    const checkSessionInterval = setInterval(async () => {
      try {
        const currentSession = await getCurrentSession()
        if (currentSession?.user) {
          // La sesión sigue siendo válida
          if (!session || session.access_token !== currentSession.access_token) {
            console.log('Sesión actualizada automáticamente')
            setSession(currentSession)
            setGoogleUser(currentSession.user)
          }
        } else if (session || googleUser) {
          // La sesión expiró, limpiar estado
          console.log('Sesión expirada, limpiando estado')
          setSession(null)
          setGoogleUser(null)
          setUser(null)
        }
      } catch (error) {
        console.error('Error verificando sesión:', error)
      }
    }, 60000) // Verificar cada minuto

    return () => clearInterval(checkSessionInterval)
  }, [session, googleUser])

  const login = (authUser: AuthUser) => {
    setUser(authUser)
    storeUser(authUser)
  }

  const logout = async () => {
    try {
      console.log('Cerrando sesión...')
      
      // Cerrar sesión de Google
      const { error: googleError } = await signOut()
      if (googleError) {
        console.error('Error cerrando sesión de Google:', googleError)
      }
      
      // Limpiar estado local
      setUser(null)
      setGoogleUser(null)
      setSession(null)
      
      // Limpiar sistema anterior
      logoutUser()
      
      console.log('Sesión cerrada exitosamente')
    } catch (error) {
      console.error('Error cerrando sesión:', error)
    }
  }

  const value = {
    user,
    googleUser,
    session,
    loading,
    login,
    logout,
    isAuthenticated: !!user || !!googleUser,
    isGoogleAuthenticated: !!googleUser
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

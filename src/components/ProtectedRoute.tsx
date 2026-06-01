'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import type { AuthRole } from '@/lib/portalAuthService'

interface ProtectedRouteProps {
  children: React.ReactNode
  /** Si se define, solo ese rol puede ver la ruta */
  roles?: AuthRole[]
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthenticated, loading, session } = useAuth()
  const router = useRouter()

  const roleOk =
    !roles?.length || (session && roles.includes(session.role))

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated) {
      router.replace('/login')
      return
    }
    if (!roleOk) {
      router.replace('/dashboard')
    }
  }, [isAuthenticated, loading, roleOk, router])

  if (loading) {
    return (
      <div className="portal-access-loading">
        <div className="portal-access-loading-spinner" />
        <p>Verificando acceso…</p>
      </div>
    )
  }

  if (!isAuthenticated || !roleOk) {
    return (
      <div className="portal-access-loading">
        <div className="portal-access-loading-spinner" />
        <p>Redirigiendo…</p>
      </div>
    )
  }

  return <>{children}</>
}

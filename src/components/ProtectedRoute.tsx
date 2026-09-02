'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { loginUrlWithReturn } from '@/lib/authReturnPath'
import type { AuthRole } from '@/lib/portalAuthService'

interface ProtectedRouteProps {
  children: React.ReactNode
  /** Si se define, solo ese rol puede ver la ruta */
  roles?: AuthRole[]
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthenticated, loading, session } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const roleOk =
    !roles?.length || (session && roles.includes(session.role))

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated) {
      const search =
        typeof window !== 'undefined' ? window.location.search : ''
      const returnPath = `${pathname || '/dashboard'}${search}`
      router.replace(loginUrlWithReturn(returnPath))
      return
    }
    if (!roleOk) {
      router.replace('/dashboard')
    }
  }, [isAuthenticated, loading, roleOk, router, pathname])

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

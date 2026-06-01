'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    router.replace(isAuthenticated ? '/dashboard' : '/login')
  }, [isAuthenticated, loading, router])

  return (
    <div className="portal-access-loading">
      <div className="portal-access-loading-spinner" />
      <p>Cargando…</p>
    </div>
  )
}

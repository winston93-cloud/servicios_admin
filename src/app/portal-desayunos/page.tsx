'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { buildServicesAlumnoEntradaUrl } from '@/lib/buildServicesAlumnoEntradaUrl'

function PortalDesayunosRedirect() {
  const { session } = useAuth()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session || session.role !== 'alumno') return

    try {
      const url = buildServicesAlumnoEntradaUrl(session, '/services')
      window.location.href = url
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo abrir el portal de servicios.'
      setError(msg)
    }
  }, [session])

  if (error) {
    return (
      <div className="portal-access-loading">
        <p>{error}</p>
        <button type="button" className="dashboard-logout-btn" onClick={() => router.replace('/dashboard')}>
          Volver al inicio
        </button>
      </div>
    )
  }

  return (
    <div className="portal-access-loading">
      <div className="portal-access-loading-spinner" />
      <p>Abriendo Desayunos, Estancias y Comidas…</p>
    </div>
  )
}

export default function PortalDesayunosPage() {
  return (
    <ProtectedRoute roles={['alumno']}>
      <PortalDesayunosRedirect />
    </ProtectedRoute>
  )
}

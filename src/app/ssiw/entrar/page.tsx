'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

function SsiwEntrarInner() {
  const { session, isAlumno, isUsuario, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!session) {
      router.replace('/login')
      return
    }

    const ambienteParam = searchParams.get('ambiente')
    const ambiente =
      ambienteParam === 'entregas'
        ? 'entregas'
        : ambienteParam === 'salida'
          ? 'salida'
          : isAlumno
            ? 'salida'
            : 'entregas'

    if (isAlumno && ambiente === 'entregas') {
      setError('Tu sesión de alumno no puede abrir entregas SSIW.')
      return
    }
    if (isUsuario && ambiente === 'salida') {
      setError('El personal abre SSIW en el módulo de entregas.')
      return
    }
    if (!isAlumno && !isUsuario) {
      router.replace('/login')
      return
    }

    let cancelado = false
    ;(async () => {
      try {
        const res = await fetch('/api/ssiw/handoff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session, ambiente }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          url?: string
          error?: string
        }
        if (!res.ok || !data.url) {
          throw new Error(data.error || 'No se pudo abrir SSIW')
        }
        if (!cancelado) {
          window.location.href = data.url
        }
      } catch (e) {
        if (!cancelado) {
          setError(e instanceof Error ? e.message : 'Error al abrir SSIW')
        }
      }
    })()

    return () => {
      cancelado = true
    }
  }, [loading, session, isAlumno, isUsuario, router, searchParams])

  return (
    <div className="dashboard-container" style={{ padding: '2rem', textAlign: 'center' }}>
      {error ? (
        <>
          <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>
          <button type="button" className="servicios-back-btn" onClick={() => router.push('/dashboard')}>
            Volver al dashboard
          </button>
        </>
      ) : (
        <p>Abriendo SSIW…</p>
      )}
    </div>
  )
}

export default function SsiwEntrarPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="dashboard-container" style={{ padding: '2rem', textAlign: 'center' }}>Abriendo SSIW…</div>}>
        <SsiwEntrarInner />
      </Suspense>
    </ProtectedRoute>
  )
}

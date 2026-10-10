'use client'

/**
 * 2026-10-10 — Guardia de Beneficios externos: sesión de personal y usuario_id
 * en la lista (ruben 1, mario 17, alan 38). Cualquier otro regresa al dashboard.
 */

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { puedeVerBeneficiosExternos } from '@/lib/beneficiosExternos/config'

function Filtro({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const router = useRouter()
  const permitido = puedeVerBeneficiosExternos(session?.usuario_id)

  useEffect(() => {
    if (!loading && !permitido) router.replace('/dashboard')
  }, [loading, permitido, router])

  if (!permitido) return null
  return <>{children}</>
}

export default function GuardiaBeneficiosExternos({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute roles={['usuario']}>
      <Filtro>{children}</Filtro>
    </ProtectedRoute>
  )
}

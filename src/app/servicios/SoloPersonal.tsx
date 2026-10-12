'use client'

/**
 * 2026-10-12 - Seguridad: el panel de Servicios es solo para personal. Una sesión de familia (alumno) que
 * abra /servicios se regresa a su portal. Los datos ya los bloquea el proxy /api/database; esto evita
 * que siquiera vea el panel.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function SoloPersonal({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const router = useRouter()
  const esFamilia = session?.role === 'alumno'

  useEffect(() => {
    if (esFamilia) router.replace('/dashboard')
  }, [esFamilia, router])

  if (esFamilia) return null
  return <>{children}</>
}

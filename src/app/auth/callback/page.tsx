'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { handleAuthCallback } from '@/lib/authService'

export default function AuthCallback() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function processAuth() {
      try {
        const { user, error: authError } = await handleAuthCallback()
        
        if (authError) {
          setError(authError.message || 'Error de autenticación')
          setTimeout(() => {
            router.push('/login')
          }, 3000)
          return
        }

        if (user) {
          // Autenticación exitosa, redirigir al dashboard
          router.push('/dashboard')
        } else {
          // No hay usuario, redirigir al login
          router.push('/login')
        }
      } catch (error) {
        console.error('Error procesando autenticación:', error)
        setError('Error inesperado durante la autenticación')
        setTimeout(() => {
          router.push('/login')
        }, 3000)
      } finally {
        setIsLoading(false)
      }
    }

    processAuth()
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Procesando autenticación...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error de Autenticación</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Redirigiendo al login...</p>
        </div>
      </div>
    )
  }

  return null
}

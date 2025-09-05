'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { loginUser } from '@/lib/authService'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { login, isAuthenticated } = useAuth()

  // Verificar si ya está logueado
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!username.trim() || !password.trim()) {
      setError('Por favor ingrese usuario y contraseña')
      return
    }

    setLoading(true)
    setError('')

    try {
      const user = await loginUser({ username: username.trim(), password: password.trim() })
      
      if (user) {
        // Usar el contexto de autenticación
        login(user)
        
        // Redirigir al dashboard
        router.push('/dashboard')
      } else {
        setError('Usuario o contraseña incorrectos')
      }
    } catch (error: unknown) {
      console.error('Error en login:', error)
      setError('Error al iniciar sesión. Intente nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e as React.FormEvent)
    }
  }


  return (
    <div className="login-container">
      <div className="login-card">
        {/* Header con gradiente */}
        <div className="login-header">
          <div className="login-icon">
            <Image 
              src="/logo.jpg" 
              alt="Logo Winston Churchill"
              width={80}
              height={80}
              className="login-logo"
            />
          </div>
          <h1 className="login-title">
            Sistema Integral de Servicios
          </h1>
          <div className="login-subtitle">
            ⭐ Instituto Winston Churchill ⭐
          </div>
        </div>

        {/* Formulario */}
        <div className="login-form">
          <div className="form-group">
            <label className="form-label">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
              Usuario/Empleado
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ingrese su usuario o número de empleado"
              className="form-input"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
              </svg>
              Clave de Acceso
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ingrese su clave de acceso"
              className="form-input"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            className="login-button"
          >
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                Iniciando Sesión...
              </>
            ) : (
              <>
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Iniciar Sesión
              </>
            )}
          </button>

        </div>

        {/* Footer */}
        <div className="login-footer">
          © 2025 Sistema Integral de Servicios. ⚡ Innovación y tecnología.
        </div>
      </div>
    </div>
  )
}

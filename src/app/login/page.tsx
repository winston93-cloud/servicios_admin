'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { loginPortal } from '@/lib/portalAuthService'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { login, isAuthenticated } = useAuth()

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard')
    }
  }, [isAuthenticated, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!username.trim() || !password.trim()) {
      setError('Ingresa tu usuario y tu clave de acceso')
      return
    }

    setLoading(true)
    setError('')

    try {
      const authSession = await loginPortal({
        username: username.trim(),
        password: password.trim(),
      })

      if (authSession) {
        login(authSession)
        router.push('/dashboard')
      } else {
        setError('Acceso no válido. Verifica tu usuario y tu clave.')
      }
    } catch (err) {
      console.error('Error en login:', err)
      setError('No se pudo conectar. Intenta de nuevo en unos momentos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="portal-access">
      <div className="portal-access-bg" aria-hidden />

      <aside className="portal-access-flank portal-access-flank--start">
        <Image
          src="/logos/logo-winston-churchill.png"
          alt="Instituto Winston Churchill"
          width={200}
          height={150}
          className="portal-access-flank-logo"
          priority
        />
        <p className="portal-access-flank-label">Instituto Winston Churchill</p>
      </aside>

      <main className="portal-access-main">
        <div className="portal-access-mobile-logos" aria-hidden>
          <Image
            src="/logos/logo-winston-churchill.png"
            alt=""
            width={72}
            height={54}
            className="portal-access-mobile-logo"
            priority
          />
          <Image
            src="/logos/logo-winston-educativo.png"
            alt=""
            width={72}
            height={54}
            className="portal-access-mobile-logo"
            priority
          />
        </div>

        <div className="portal-access-card">
          <header className="portal-access-card-head">
            <p className="portal-access-eyebrow">Sistema integral</p>
            <h1 className="portal-access-title">Servicios Administrativos</h1>
            <p className="portal-access-lead">
              Acceso unificado para familias y personal de los dos planteles Winston.
              <br />
              Tu perfil determina los módulos disponibles.
            </p>
          </header>

          <form className="portal-access-form" onSubmit={handleSubmit}>
            <div className="portal-access-field">
              <label htmlFor="portal-username" className="portal-access-label">
                Usuario
              </label>
              <input
                id="portal-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Usuario"
                className="portal-access-input"
                disabled={loading}
                autoComplete="username"
              />
            </div>

            <div className="portal-access-field">
              <label htmlFor="portal-password" className="portal-access-label">
                Clave de acceso
              </label>
              <input
                id="portal-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu clave secreta"
                className="portal-access-input"
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="portal-access-error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="portal-access-submit"
            >
              {loading ? 'Verificando acceso…' : 'Entrar al sistema'}
            </button>
          </form>

          <footer className="portal-access-foot">
            <span>Winston Churchill</span>
            <span className="portal-access-foot-dot" aria-hidden />
            <span>Winston Educativo</span>
          </footer>
        </div>
      </main>

      <aside className="portal-access-flank portal-access-flank--end">
        <Image
          src="/logos/logo-winston-educativo.png"
          alt="Winston Educativo"
          width={200}
          height={150}
          className="portal-access-flank-logo"
          priority
        />
        <p className="portal-access-flank-label">Winston Educativo</p>
      </aside>
    </div>
  )
}

'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Eye, EyeOff } from 'lucide-react'
import { safeAuthReturnPath } from '@/lib/authReturnPath'
import { loginPortal } from '@/lib/portalAuthService'
import { useAuth } from '@/contexts/AuthContext'
import ThemeToggle from '@/components/ThemeToggle'

type VistaLogin = 'entrar' | 'activar-clave'

function LoginPageInner() {
  const [vista, setVista] = useState<VistaLogin>('entrar')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [claveRef, setClaveRef] = useState('')
  const [claveNueva, setClaveNueva] = useState('')
  const [claveConfirmacion, setClaveConfirmacion] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [mostrarClaveNueva, setMostrarClaveNueva] = useState(false)
  const [mostrarClaveConfirm, setMostrarClaveConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, isAuthenticated } = useAuth()

  const afterLoginPath = useMemo(
    () => safeAuthReturnPath(searchParams.get('next')) ?? '/dashboard',
    [searchParams]
  )

  useEffect(() => {
    if (!isAuthenticated) return
    // Si vinieron con ?next=/ruta (ej. revisión de entrada), volver ahí.
    router.replace(afterLoginPath)
  }, [isAuthenticated, router, afterLoginPath])

  const limpiarMensajes = () => {
    setError('')
    setExito('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!username.trim() || !password.trim()) {
      setError('Ingresa tu usuario y tu clave de acceso')
      return
    }

    setLoading(true)
    limpiarMensajes()

    try {
      const authSession = await loginPortal({
        username: username.trim(),
        password: password.trim(),
      })

      if (authSession) {
        login(authSession)
        // Limpia campos para que el navegador no reutilice credenciales en pantalla.
        setUsername('')
        setPassword('')
        router.push(afterLoginPath)
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

  const handleRegistrarClave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!claveRef.trim() || !claveNueva.trim() || !claveConfirmacion.trim()) {
      setError('Completa número de control, clave nueva y confirmación.')
      return
    }

    setLoading(true)
    limpiarMensajes()

    try {
      const res = await fetch('/api/auth/registrar-clave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumnoRef: claveRef.trim(),
          claveNueva: claveNueva.trim(),
          claveConfirmacion: claveConfirmacion.trim(),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'No se pudo activar la clave.')
        return
      }

      setExito(
        typeof data.mensaje === 'string'
          ? data.mensaje
          : 'Tu clave ha sido activada con éxito.'
      )
      setUsername(claveRef.trim())
      setPassword('')
      setClaveNueva('')
      setClaveConfirmacion('')
      setVista('entrar')
    } catch (err) {
      console.error('Error al registrar clave:', err)
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
          src="/logos/logo-winston-w.png"
          alt="Instituto Winston Churchill"
          width={200}
          height={150}
          className="portal-access-flank-logo portal-access-flank-logo--winston saas-logo-glow"
          priority
        />
        <p className="portal-access-flank-label">Instituto Winston Churchill</p>
      </aside>

      <main className="portal-access-main">
        <div className="portal-access-theme-row">
          <ThemeToggle />
        </div>
        <div className="portal-access-mobile-logos" aria-hidden>
          <Image
            src="/logos/logo-winston-w.png"
            alt=""
            width={72}
            height={54}
            className="portal-access-mobile-logo portal-access-mobile-logo--winston saas-logo-glow"
            priority
          />
          <Image
            src="/logos/logo-winston-educativo.png"
            alt=""
            width={72}
            height={54}
            className="portal-access-mobile-logo saas-logo-glow"
            priority
          />
        </div>

        <div className="portal-access-card portal-access-card--glass">
          <header className="portal-access-card-head saas-reveal saas-reveal--1">
            <p className="portal-access-eyebrow">Sistema integral</p>
            <h1 className="portal-access-title">Servicios Administrativos</h1>
          </header>

          <div className="portal-access-tabs" role="tablist" aria-label="Acceso al portal">
            <button
              type="button"
              role="tab"
              aria-selected={vista === 'entrar'}
              className={`portal-access-tab${vista === 'entrar' ? ' is-active' : ''}`}
              onClick={() => {
                setVista('entrar')
                limpiarMensajes()
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={vista === 'activar-clave'}
              className={`portal-access-tab${vista === 'activar-clave' ? ' is-active' : ''}`}
              onClick={() => {
                setVista('activar-clave')
                limpiarMensajes()
              }}
            >
              Activar clave
            </button>
          </div>

          {vista === 'entrar' ? (
            <form
              className="portal-access-form"
              onSubmit={handleSubmit}
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore
            >
              <div className="portal-access-field saas-reveal saas-reveal--2">
                <label htmlFor="portal-username" className="portal-access-label">
                  Usuario
                </label>
                <input
                  id="portal-username"
                  type="text"
                  name="portal-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="No. de control o usuario"
                  className="portal-access-input"
                  disabled={loading}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </div>

              <div className="portal-access-field saas-reveal saas-reveal--3">
                <label htmlFor="portal-password" className="portal-access-label">
                  Clave de acceso
                </label>
                <div className="portal-access-clave-fila">
                  <input
                    id="portal-password"
                    type={mostrarPassword ? 'text' : 'password'}
                    name="portal-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tu clave secreta"
                    className="portal-access-input"
                    disabled={loading}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="portal-access-clave-btn"
                    onClick={() => setMostrarPassword((v) => !v)}
                    aria-label={mostrarPassword ? 'Ocultar clave' : 'Ver clave'}
                    aria-pressed={mostrarPassword}
                  >
                    {mostrarPassword ? (
                      <EyeOff size={18} aria-hidden />
                    ) : (
                      <Eye size={18} aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p className="portal-access-error saas-reveal saas-reveal--4" role="alert">
                  {error}
                </p>
              )}

              {exito && (
                <p className="portal-access-success saas-reveal saas-reveal--4" role="status">
                  {exito}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="portal-access-submit saas-reveal saas-reveal--5"
              >
                {loading ? 'Verificando acceso…' : 'Entrar al sistema'}
              </button>

              <p className="portal-access-hint portal-access-hint--mobile">
                ¿Primera vez? Ve a <strong>Activar clave</strong> para registrar tu acceso.
              </p>
            </form>
          ) : (
            <form className="portal-access-form" onSubmit={handleRegistrarClave}>
              <p className="portal-access-lead">
                Si aún no tienes clave, regístrala aquí con tu número de control.
              </p>

              <div className="portal-access-field">
                <label htmlFor="clave-ref" className="portal-access-label">
                  Número de control
                </label>
                <input
                  id="clave-ref"
                  type="text"
                  value={claveRef}
                  onChange={(e) => setClaveRef(e.target.value)}
                  placeholder="No. de control"
                  className="portal-access-input"
                  disabled={loading}
                  autoComplete="username"
                  maxLength={5}
                  inputMode="numeric"
                />
              </div>

              <div className="portal-access-field">
                <label htmlFor="clave-nueva" className="portal-access-label">
                  Nueva clave
                </label>
                <div className="portal-access-clave-fila">
                  <input
                    id="clave-nueva"
                    type={mostrarClaveNueva ? 'text' : 'password'}
                    value={claveNueva}
                    onChange={(e) => setClaveNueva(e.target.value)}
                    placeholder="Mínimo 5 caracteres"
                    className="portal-access-input"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="portal-access-clave-btn"
                    onClick={() => setMostrarClaveNueva((v) => !v)}
                    aria-label={mostrarClaveNueva ? 'Ocultar clave' : 'Ver clave'}
                    aria-pressed={mostrarClaveNueva}
                  >
                    {mostrarClaveNueva ? (
                      <EyeOff size={18} aria-hidden />
                    ) : (
                      <Eye size={18} aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              <div className="portal-access-field">
                <label htmlFor="clave-confirm" className="portal-access-label">
                  Confirmar clave
                </label>
                <div className="portal-access-clave-fila">
                  <input
                    id="clave-confirm"
                    type={mostrarClaveConfirm ? 'text' : 'password'}
                    value={claveConfirmacion}
                    onChange={(e) => setClaveConfirmacion(e.target.value)}
                    placeholder="Repite tu clave"
                    className="portal-access-input"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="portal-access-clave-btn"
                    onClick={() => setMostrarClaveConfirm((v) => !v)}
                    aria-label={
                      mostrarClaveConfirm ? 'Ocultar confirmación' : 'Ver confirmación'
                    }
                    aria-pressed={mostrarClaveConfirm}
                  >
                    {mostrarClaveConfirm ? (
                      <EyeOff size={18} aria-hidden />
                    ) : (
                      <Eye size={18} aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p className="portal-access-error" role="alert">
                  {error}
                </p>
              )}

              {exito && (
                <p className="portal-access-success" role="status">
                  {exito}
                </p>
              )}

              <button type="submit" disabled={loading} className="portal-access-submit">
                {loading ? 'Guardando clave…' : 'Registrar clave'}
              </button>
            </form>
          )}

          <footer className="portal-access-foot">
            <span>Instituto Winston Churchill</span>
            <span className="portal-access-foot-dot" aria-hidden />
            <span>Instituto Educativo Winston</span>
          </footer>
        </div>
      </main>

      <aside className="portal-access-flank portal-access-flank--end">
        <Image
          src="/logos/logo-winston-educativo.png"
          alt="Instituto Educativo Winston"
          width={200}
          height={150}
          className="portal-access-flank-logo saas-logo-glow"
          priority
        />
        <p className="portal-access-flank-label">Instituto Educativo Winston</p>
      </aside>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="portal-access-loading">
          <div className="portal-access-loading-spinner" />
          <p>Cargando…</p>
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  )
}

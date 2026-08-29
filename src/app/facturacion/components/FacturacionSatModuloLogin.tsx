'use client'

import { useId, useState } from 'react'
import { Eye, EyeOff, KeyRound, LogIn, ShieldCheck, UserRound } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'

type Props = {
  onAutenticado: (usuario: string) => void
}

export default function FacturacionSatModuloLogin({ onAutenticado }: Props) {
  const usuarioId = useId()
  const claveId = useId()
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [mostrarClave, setMostrarClave] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!usuario.trim() || !clave) {
      setError('Ingrese usuario y clave.')
      return
    }
    setCargando(true)
    try {
      const res = await fetch('/api/sat/modulo-login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario: usuario.trim(), clave }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        usuario?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.usuario) {
        setError(data.error || 'Usuario o clave incorrectos.')
        return
      }
      setClave('')
      onAutenticado(data.usuario)
    } catch {
      setError('No se pudo conectar. Intente de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="dashboard-container facturacion-cfdi-page facturacion-cfdi-sat-login-page">
      <div className="dashboard-home-bg" aria-hidden="true" />
      <div className="dashboard-main facturacion-cfdi-sat-login-main">
        <div className="facturacion-cfdi-sat-login-theme">
          <ThemeToggle />
        </div>

        <div className="facturacion-cfdi-sat-login-card">
          <div className="facturacion-cfdi-sat-login-icon" aria-hidden>
            <ShieldCheck size={32} />
          </div>
          <h1 className="facturacion-cfdi-sat-login-title">Módulo SAT</h1>
          <p className="facturacion-cfdi-sat-login-subtitle">
            Acceso restringido — descarga masiva y conciliación fiscal
          </p>

          <form className="facturacion-cfdi-sat-login-form" onSubmit={(e) => void enviar(e)}>
            <label className="facturacion-cfdi-field facturacion-cfdi-field-wide" htmlFor={usuarioId}>
              <span className="facturacion-cfdi-sat-field-row">
                <UserRound size={14} aria-hidden />
                Usuario
              </span>
              <input
                id={usuarioId}
                type="text"
                className="facturacion-cfdi-input"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                autoComplete="username"
                disabled={cargando}
                placeholder="Usuario del módulo"
              />
            </label>

            <label className="facturacion-cfdi-field facturacion-cfdi-field-wide" htmlFor={claveId}>
              <span className="facturacion-cfdi-sat-field-row">
                <KeyRound size={14} aria-hidden />
                Clave
              </span>
              <div className="facturacion-cfdi-sat-login-clave-row">
                <input
                  id={claveId}
                  type={mostrarClave ? 'text' : 'password'}
                  className="facturacion-cfdi-input"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  autoComplete="current-password"
                  disabled={cargando}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="facturacion-cfdi-sat-login-eye"
                  onClick={() => setMostrarClave((v) => !v)}
                  aria-label={mostrarClave ? 'Ocultar clave' : 'Mostrar clave'}
                >
                  {mostrarClave ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {error ? (
              <p className="facturacion-cfdi-sat-login-error" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="facturacion-cfdi-btn-primary facturacion-cfdi-sat-login-submit"
              disabled={cargando}
            >
              <LogIn size={16} aria-hidden />
              {cargando ? 'Verificando…' : 'Entrar al módulo SAT'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

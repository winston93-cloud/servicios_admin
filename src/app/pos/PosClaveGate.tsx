'use client'

import { FormEvent, type ReactNode, useEffect, useState } from 'react'
import './pos-login.css'

type Fase = 'cargando' | 'login' | 'ok'

export default function PosClaveGate({ children }: { children: ReactNode }) {
  const [fase, setFase] = useState<Fase>('cargando')
  const [clave, setClave] = useState('')
  const [mostrarClave, setMostrarClave] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      try {
        const res = await fetch('/api/pos/auth', { method: 'GET', cache: 'no-store' })
        if (cancelado) return
        setFase(res.ok ? 'ok' : 'login')
      } catch {
        if (!cancelado) setFase('login')
      }
    })()
    return () => {
      cancelado = true
    }
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const res = await fetch('/api/pos/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error || 'Contraseña incorrecta.')
        return
      }
      setFase('ok')
    } catch {
      setError('No se pudo validar la contraseña. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (fase === 'cargando') {
    return (
      <div className="pos-login-shell">
        <div className="pos-login-loading" role="status">
          <svg className="pos-login-spin" width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
            <path
              d="M21 12a9 9 0 0 0-9-9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          Verificando acceso…
        </div>
      </div>
    )
  }

  if (fase === 'ok') {
    return <>{children}</>
  }

  return (
    <div className="pos-login-shell">
      <div className="pos-login-backdrop" aria-hidden />
      <div
        className="pos-login-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-login-title"
      >
        <div className="pos-login-brand">
          <div className="pos-login-icon" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M17 8h1a4 4 0 0 1 0 8h-1"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <line x1="6" y1="2" x2="6" y2="5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="10" y1="2" x2="10" y2="5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="14" y1="2" x2="14" y2="5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="pos-login-eyebrow">Winston · Desayunos</p>
            <h1 id="pos-login-title" className="pos-login-title">
              Acceso al punto de venta
            </h1>
            <p className="pos-login-lead">Desayunos, estancias y comidas</p>
          </div>
        </div>

        <form className="pos-login-form" onSubmit={onSubmit}>
          <label className="pos-login-label" htmlFor="pos-clave">
            Contraseña
          </label>
          <div className="pos-login-clave-fila">
            <span className="pos-login-clave-lock" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M8 11V8a4 4 0 1 1 8 0v3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <rect x="6" y="11" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </span>
            <input
              id="pos-clave"
              className="pos-login-input"
              type={mostrarClave ? 'text' : 'password'}
              name="clave"
              autoComplete="current-password"
              autoFocus
              placeholder="Ingresa la contraseña"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              disabled={enviando}
              required
            />
            <button
              type="button"
              className="pos-login-eye"
              onClick={() => setMostrarClave((v) => !v)}
              aria-label={mostrarClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {mostrarClave ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M3 3l18 18M10.6 10.6A3 3 0 0 0 13.4 13.4M9.9 5.2A10.5 10.5 0 0 1 12 5c5 0 9.3 3.1 11 7.5a12.3 12.3 0 0 1-4.2 5.1M6.1 6.1A12.3 12.3 0 0 0 1 12.5C2.7 16.9 7 20 12 20c1.4 0 2.7-.2 4-.7"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M1 12.5C2.7 8.1 7 5 12 5s9.3 3.1 11 7.5C21.3 16.9 17 20 12 20S2.7 16.9 1 12.5Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.7" />
                </svg>
              )}
            </button>
          </div>

          {error ? (
            <p className="pos-login-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="pos-login-submit" type="submit" disabled={enviando || !clave.trim()}>
            {enviando ? (
              <>
                <svg className="pos-login-spin" width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
                  <path
                    d="M21 12a9 9 0 0 0-9-9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
                Validando…
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import './dif2.css'

type Fase = 'cargando' | 'login' | 'pdf'

export default function Dif2Page() {
  const searchParams = useSearchParams()
  const ciclo = searchParams.get('ciclo')?.trim() || ''
  const format = searchParams.get('format') === 'html' ? 'html' : 'pdf'

  const pdfSrc = useMemo(() => {
    const q = new URLSearchParams({ format })
    if (ciclo) q.set('ciclo', ciclo)
    return `/api/dif2/pdf?${q.toString()}`
  }, [ciclo, format])

  const [fase, setFase] = useState<Fase>('cargando')
  const [clave, setClave] = useState('')
  const [mostrarClave, setMostrarClave] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      try {
        const res = await fetch('/api/dif2/auth', { method: 'GET', cache: 'no-store' })
        if (cancelado) return
        setFase(res.ok ? 'pdf' : 'login')
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
      const res = await fetch('/api/dif2/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error || 'Contraseña incorrecta.')
        return
      }
      setFase('pdf')
    } catch {
      setError('No se pudo validar la contraseña. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (fase === 'cargando') {
    return (
      <div className="dif2-shell">
        <div className="dif2-loading" role="status">
          <svg className="dif2-spin" width="18" height="18" viewBox="0 0 24 24" aria-hidden>
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

  if (fase === 'pdf') {
    return (
      <div className="dif2-shell dif2-shell--pdf">
        <iframe className="dif2-iframe" title="Reporte inscripciones 2º diferido" src={pdfSrc} />
      </div>
    )
  }

  return (
    <div className="dif2-shell">
      <div className="dif2-backdrop" aria-hidden />
      <div
        className="dif2-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dif2-modal-title"
      >
        <div className="dif2-modal-brand">
          <div className="dif2-modal-icon" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M7 10V8a5 5 0 0 1 10 0v2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <rect
                x="5"
                y="10"
                width="14"
                height="11"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          </div>
          <div>
            <p className="dif2-modal-eyebrow">Winston · Servicios</p>
            <h1 id="dif2-modal-title" className="dif2-modal-title">
              Acceso al reporte
            </h1>
            <p className="dif2-modal-lead">Inscripciones admin · 2º diferido</p>
          </div>
        </div>

        <form className="dif2-form" onSubmit={onSubmit}>
          <label className="dif2-label" htmlFor="dif2-clave">
            Contraseña
          </label>
          <div className="dif2-clave-fila">
            <span className="dif2-clave-lock" aria-hidden>
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
              id="dif2-clave"
              className="dif2-input"
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
              className="dif2-eye"
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
            <p className="dif2-error" role="alert">
              {error}
            </p>
          ) : null}

          <button className="dif2-submit" type="submit" disabled={enviando || !clave.trim()}>
            {enviando ? (
              <>
                <svg className="dif2-spin" width="16" height="16" viewBox="0 0 24 24" aria-hidden>
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
              'Ver reporte'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

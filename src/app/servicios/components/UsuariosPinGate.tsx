'use client'

import { FormEvent, type ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Loader2 } from 'lucide-react'

type Fase = 'cargando' | 'login' | 'ok'

export default function UsuariosPinGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [fase, setFase] = useState<Fase>('cargando')
  const [pin, setPin] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      try {
        const res = await fetch('/api/usuarios/auth', { method: 'GET', cache: 'no-store' })
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
      const res = await fetch('/api/usuarios/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error || 'PIN incorrecto.')
        return
      }
      setFase('ok')
    } catch {
      setError('No se pudo validar el PIN. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (fase === 'cargando') {
    return (
      <div className="usr-pin-shell" role="status">
        <Loader2 className="usr-spin" size={22} aria-hidden />
        <span>Verificando acceso…</span>
      </div>
    )
  }

  if (fase === 'ok') {
    return <>{children}</>
  }

  return (
    <div className="usr-modal-overlay usr-pin-overlay" role="dialog" aria-modal="true" aria-labelledby="usr-pin-title">
      <form className="usr-pin-caja" onSubmit={onSubmit}>
        <div className="usr-pin-brand">
          <div className="usr-pin-icon" aria-hidden>
            <KeyRound size={22} />
          </div>
          <div>
            <p className="usr-pin-eyebrow">Servicios · Usuarios</p>
            <h2 id="usr-pin-title" className="usr-pin-title">
              Acceso al catálogo
            </h2>
            <p className="usr-pin-lead">Ingresa el PIN para crear, editar o eliminar usuarios.</p>
          </div>
        </div>

        <label className="usr-pin-label" htmlFor="usr-pin-input">
          PIN de acceso
        </label>
        <div className="usr-pin-fila">
          <input
            id="usr-pin-input"
            className="usr-pin-input"
            type={mostrar ? 'text' : 'password'}
            name="pin"
            autoComplete="off"
            autoFocus
            placeholder="Ingresa el PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            disabled={enviando}
            required
          />
          <button
            type="button"
            className="usr-pin-eye"
            onClick={() => setMostrar((v) => !v)}
            aria-label={mostrar ? 'Ocultar PIN' : 'Mostrar PIN'}
          >
            {mostrar ? 'Ocultar' : 'Ver'}
          </button>
        </div>

        {error ? (
          <p className="usr-pin-error" role="alert">
            {error}
          </p>
        ) : null}

        <button className="usr-btn usr-btn-primary usr-pin-submit" type="submit" disabled={enviando || !pin.trim()}>
          {enviando ? (
            <>
              <Loader2 className="usr-spin" size={16} aria-hidden />
              Validando…
            </>
          ) : (
            'Entrar'
          )}
        </button>
        <button
          type="button"
          className="usr-btn usr-pin-back"
          onClick={() => router.replace('/servicios?modulo=alumnos')}
          disabled={enviando}
        >
          Volver a Servicios
        </button>
      </form>
    </div>
  )
}

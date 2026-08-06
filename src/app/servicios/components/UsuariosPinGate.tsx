'use client'

import { FormEvent, type ReactNode, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Loader2 } from 'lucide-react'

type Fase = 'login' | 'ok'

type Props = {
  children: ReactNode
  eyebrow?: string
  titulo?: string
  lead?: string
}

async function cerrarSesionPin() {
  try {
    await fetch('/api/usuarios/auth', { method: 'DELETE', cache: 'no-store' })
  } catch {
    /* ignore */
  }
}

/**
 * Pide el PIN en cada apertura del módulo.
 * La cookie solo vive mientras el módulo está abierto (se borra al montar/desmontar).
 */
export default function UsuariosPinGate({
  children,
  eyebrow = 'Servicios · Usuarios',
  titulo = 'Acceso al catálogo',
  lead = 'Ingresa el PIN para crear, editar o eliminar usuarios.',
}: Props) {
  const router = useRouter()
  const [fase, setFase] = useState<Fase>('login')
  const [pin, setPin] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      await cerrarSesionPin()
      if (!cancelado) {
        setFase('login')
        setPin('')
        setError('')
      }
    })()

    return () => {
      cancelado = true
      void cerrarSesionPin()
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
      setPin('')
      setFase('ok')
    } catch {
      setError('No se pudo validar el PIN. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (fase === 'ok') {
    return <>{children}</>
  }

  return (
    <div
      className="usr-modal-overlay usr-pin-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="usr-pin-title"
    >
      <form className="usr-pin-caja" onSubmit={onSubmit}>
        <div className="usr-pin-brand">
          <div className="usr-pin-icon" aria-hidden>
            <KeyRound size={22} />
          </div>
          <div>
            <p className="usr-pin-eyebrow">{eyebrow}</p>
            <h2 id="usr-pin-title" className="usr-pin-title">
              {titulo}
            </h2>
            <p className="usr-pin-lead">{lead}</p>
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

        <button
          className="usr-btn usr-btn-primary usr-pin-submit"
          type="submit"
          disabled={enviando || !pin.trim()}
        >
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

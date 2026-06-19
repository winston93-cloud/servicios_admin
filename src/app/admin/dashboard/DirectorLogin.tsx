'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const LEVELS = [
  { value: 'maternal_kinder', label: 'Maternal y Kinder', icon: '🌱' },
  { value: 'primaria',        label: 'Primaria',          icon: '📚' },
  { value: 'secundaria',      label: 'Secundaria',        icon: '🎓' },
]

export default function DirectorLogin() {
  const router = useRouter()
  const [level, setLevel] = useState('')
  const [pin,   setPin]   = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/director-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, pin }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Acceso denegado')
        return
      }
      router.refresh()
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="director-login-page">
      <div className="director-login-card">
        <div className="director-login-header">
          <div className="director-login-logo">🏫</div>
          <h1>Dashboard Directoras</h1>
          <p>Sistema de Autorización de Cambios</p>
        </div>

        <form onSubmit={handleSubmit} className="director-login-form">
          <div className="director-login-levels">
            {LEVELS.map(l => (
              <button
                key={l.value}
                type="button"
                className={`director-level-btn ${level === l.value ? 'active' : ''}`}
                onClick={() => setLevel(l.value)}
              >
                <span className="director-level-icon">{l.icon}</span>
                <span className="director-level-label">{l.label}</span>
              </button>
            ))}
          </div>

          <div className="director-login-field">
            <label>PIN de acceso</label>
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="••••••"
              maxLength={20}
              autoComplete="current-password"
              className="director-pin-input"
            />
          </div>

          {error && <p className="director-login-error">⚠️ {error}</p>}

          <button
            type="submit"
            className="director-login-btn"
            disabled={loading || !level || !pin}
          >
            {loading ? 'Verificando…' : 'Entrar al Dashboard →'}
          </button>
        </form>

        <p className="director-login-footer">
          Instituto Educativo Winston / Winston Churchill
        </p>
      </div>
    </div>
  )
}

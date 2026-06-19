'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const ROLES = [
  { value: 'psi_mk',  label: 'Maternal y Kinder', group: 'Psicología' },
  { value: 'psi_pri', label: 'Primaria',           group: 'Psicología' },
  { value: 'psi_sec', label: 'Secundaria',         group: 'Psicología' },
  { value: 'vin_mk',  label: 'Maternal y Kinder',  group: 'Vinculación' },
  { value: 'vin_pri', label: 'Primaria y Secundaria', group: 'Vinculación' },
]

const GROUPS = ['Psicología', 'Vinculación']

function AdminLoginForm() {
  const router      = useRouter()
  const searchParams = useSearchParams()
  const [role,    setRole]    = useState('')
  const [pin,     setPin]     = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, pin }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Acceso denegado')
        return
      }
      const next = searchParams.get('next') || '/admin'
      router.push(next)
      router.refresh()
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login-card">
      <div className="admin-login-header">
        <h1>Panel Administrativo</h1>
        <p>Selecciona tu área y nivel, luego ingresa tu PIN</p>
      </div>

      <form onSubmit={handleSubmit} className="admin-login-form">
        <div className="admin-login-groups">
          {GROUPS.map(group => (
            <div key={group} className="admin-login-group">
              <p className="admin-login-group-label">{group}</p>
              <div className="admin-login-roles">
                {ROLES.filter(r => r.group === group).map(r => (
                  <button
                    key={r.value}
                    type="button"
                    className={`admin-role-btn${role === r.value ? ' active' : ''}`}
                    onClick={() => { setRole(r.value); setError('') }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="admin-login-field">
          <label htmlFor="admin-pin">PIN de acceso</label>
          <input
            id="admin-pin"
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="••••••"
            maxLength={20}
            autoComplete="current-password"
            className="admin-pin-input"
            disabled={!role}
          />
        </div>

        {error && <p className="admin-login-error">{error}</p>}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !role || !pin}
        >
          {loading ? 'Verificando…' : 'Entrar →'}
        </button>
      </form>

      <p className="admin-login-footer">
        Instituto Educativo Winston · Winston Churchill
      </p>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <div className="admin-login-page">
      <Suspense fallback={<div className="admin-login-card">Cargando…</div>}>
        <AdminLoginForm />
      </Suspense>
    </div>
  )
}

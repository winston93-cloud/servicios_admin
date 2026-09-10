'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type RacGoogleCandidate = {
  tipo: 'maestro' | 'usuario'
  id: number
  role: string
  perfil: number
  nombre: string
  usuario: string
  etiquetaRol: string
}

type Props = {
  /** POST endpoint, p.ej. /api/rac/auth/google */
  authUrl: string
  onOk: () => void
  /** Prefijo CSS: secundaria `rac` o primaria/M-K `racn` */
  classPrefix?: 'rac' | 'racn'
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: {
            client_id: string
            callback: (res: { credential?: string }) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | boolean>
          ) => void
          cancel: () => void
        }
      }
    }
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client'

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.accounts?.id) return Promise.resolve()
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('No se cargó Google Sign-In')))
      if (window.google?.accounts?.id) resolve()
    })
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = GIS_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('No se cargó Google Sign-In'))
    document.head.appendChild(s)
  })
}

export default function RacGoogleSignIn({ authUrl, onOk, classPrefix = 'racn' }: Props) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID?.trim() || ''
  const btnHost = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<RacGoogleCandidate[] | null>(null)
  const [emailAmbiguo, setEmailAmbiguo] = useState('')

  const p = classPrefix

  const postGoogle = useCallback(
    async (token: string, account?: { tipo: string; id: number }) => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(authUrl, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(account ? { idToken: token, account } : { idToken: token }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          code?: string
          error?: string
          email?: string
          candidates?: RacGoogleCandidate[]
        }
        if (res.status === 409 && data.code === 'ambiguous' && data.candidates?.length) {
          setIdToken(token)
          setCandidates(data.candidates)
          setEmailAmbiguo(data.email ?? '')
          return
        }
        if (!res.ok || data.ok === false) {
          throw new Error(data.error || 'No se pudo entrar con Google')
        }
        setCandidates(null)
        setIdToken(null)
        onOk()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo entrar con Google')
      } finally {
        setLoading(false)
      }
    },
    [authUrl, onOk]
  )

  useEffect(() => {
    if (!clientId || !btnHost.current) return
    let cancelled = false
    void (async () => {
      try {
        await loadGisScript()
        if (cancelled || !btnHost.current || !window.google?.accounts?.id) return
        btnHost.current.innerHTML = ''
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (res) => {
            const cred = res.credential
            if (!cred) {
              setError('Google no devolvió credenciales.')
              return
            }
            void postGoogle(cred)
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        window.google.accounts.id.renderButton(btnHost.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 320,
          locale: 'es',
        })
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo iniciar Google')
        }
      }
    })()
    return () => {
      cancelled = true
      try {
        window.google?.accounts?.id?.cancel()
      } catch {
        /* ignore */
      }
    }
  }, [clientId, postGoogle])

  if (!clientId) {
    return (
      <p className={`${p}-login-google-hint`}>
        Google Auth pendiente de configurar (Client ID).
      </p>
    )
  }

  return (
    <div className={`${p}-login-google`}>
      <div className={`${p}-login-divider`} role="separator">
        <span>o</span>
      </div>
      <div className={`${p}-login-google-btn`} ref={btnHost} />
      {loading ? <p className={`${p}-login-google-hint`}>Validando Google…</p> : null}
      {error ? <p className={`${p}-login-error`}>{error}</p> : null}

      {candidates && idToken ? (
        <div className={`${p}-login-google-pick`} role="dialog" aria-label="Elegir cuenta">
          <p className={`${p}-login-google-pick-title`}>
            Este correo está en varias cuentas
            {emailAmbiguo ? ` (${emailAmbiguo})` : ''}. Elige con cuál entrar:
          </p>
          <ul className={`${p}-login-google-pick-list`}>
            {candidates.map((c) => (
              <li key={`${c.tipo}-${c.id}`}>
                <button
                  type="button"
                  className={`${p}-login-google-pick-btn`}
                  disabled={loading}
                  onClick={() => void postGoogle(idToken, { tipo: c.tipo, id: c.id })}
                >
                  <strong>{c.nombre}</strong>
                  <span>
                    {c.etiquetaRol} · @{c.usuario || c.id}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={`${p}-login-google-pick-cancel`}
            onClick={() => {
              setCandidates(null)
              setIdToken(null)
              setEmailAmbiguo('')
            }}
          >
            Cancelar
          </button>
        </div>
      ) : null}
    </div>
  )
}

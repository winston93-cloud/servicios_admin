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

type TokenClient = {
  requestAccessToken: (override?: { prompt?: string }) => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id?: {
          disableAutoSelect?: () => void
          cancel?: () => void
        }
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string
            scope: string
            prompt?: string
            callback: (res: {
              access_token?: string
              error?: string
              error_description?: string
            }) => void
            error_callback?: (err: { type?: string; message?: string }) => void
          }) => TokenClient
        }
      }
    }
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client'

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('No se cargó Google Sign-In')))
      if (window.google?.accounts?.oauth2) resolve()
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
  const tokenClientRef = useRef<TokenClient | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<RacGoogleCandidate[] | null>(null)
  const [emailAmbiguo, setEmailAmbiguo] = useState('')

  const p = classPrefix

  const postGoogle = useCallback(
    async (
      token: string,
      account?: { tipo: string; id: number; role?: string; perfil?: number }
    ) => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(authUrl, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            account ? { accessToken: token, account } : { accessToken: token }
          ),
        })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          code?: string
          error?: string
          email?: string
          candidates?: RacGoogleCandidate[]
        }
        if (res.status === 409 && data.code === 'ambiguous' && data.candidates?.length) {
          setAccessToken(token)
          setCandidates(data.candidates)
          setEmailAmbiguo(data.email ?? '')
          return
        }
        if (!res.ok || data.ok === false) {
          throw new Error(data.error || 'No se pudo entrar con Google')
        }
        setCandidates(null)
        setAccessToken(null)
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
    if (!clientId) return
    let cancelled = false
    void (async () => {
      try {
        await loadGisScript()
        if (cancelled || !window.google?.accounts?.oauth2) return
        try {
          window.google.accounts.id?.disableAutoSelect?.()
        } catch {
          /* ignore */
        }
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'openid email profile',
          prompt: 'select_account',
          callback: (res) => {
            if (res.error) {
              if (res.error === 'access_denied' || res.error === 'popup_closed_by_user') {
                setLoading(false)
                return
              }
              setLoading(false)
              setError(res.error_description || res.error || 'No se pudo iniciar con Google')
              return
            }
            const token = res.access_token
            if (!token) {
              setLoading(false)
              setError('Google no devolvió credenciales.')
              return
            }
            void postGoogle(token)
          },
          error_callback: (err) => {
            setLoading(false)
            if (err?.type === 'popup_closed') return
            setError(err?.message || 'No se pudo abrir Google')
          },
        })
        if (!cancelled) setReady(true)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo iniciar Google')
        }
      }
    })()
    return () => {
      cancelled = true
      try {
        window.google?.accounts?.id?.cancel?.()
      } catch {
        /* ignore */
      }
    }
  }, [clientId, postGoogle])

  function abrirGoogle() {
    setError('')
    setCandidates(null)
    setAccessToken(null)
    setLoading(true)
    try {
      window.google?.accounts?.id?.disableAutoSelect?.()
    } catch {
      /* ignore */
    }
    const client = tokenClientRef.current
    if (!client) {
      setLoading(false)
      setError('Google aún no está listo. Reintenta en un momento.')
      return
    }
    // Siempre selector de cuenta (como login de inicio).
    client.requestAccessToken({ prompt: 'select_account' })
  }

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
      <button
        type="button"
        className={`${p}-login-google-custom`}
        onClick={abrirGoogle}
        disabled={loading || !ready}
      >
        <span className={`${p}-login-google-g`} aria-hidden>
          G
        </span>
        {loading ? 'Conectando con Google…' : 'Continuar con Google'}
      </button>
      {!ready && !error ? (
        <p className={`${p}-login-google-hint`}>Cargando Google…</p>
      ) : null}
      {error ? <p className={`${p}-login-error`}>{error}</p> : null}

      {candidates && accessToken ? (
        <div className={`${p}-login-google-pick`} role="dialog" aria-label="Elegir perfil">
          <p className={`${p}-login-google-pick-title`}>
            Elige con qué perfil entrar
            {emailAmbiguo ? ` (${emailAmbiguo})` : ''}:
          </p>
          <ul className={`${p}-login-google-pick-list`}>
            {candidates.map((c) => (
              <li key={`${c.tipo}-${c.id}-${c.role}-${c.perfil}`}>
                <button
                  type="button"
                  className={`${p}-login-google-pick-btn`}
                  disabled={loading}
                  onClick={() =>
                    void postGoogle(accessToken, {
                      tipo: c.tipo,
                      id: c.id,
                      role: c.role,
                      perfil: c.perfil,
                    })
                  }
                >
                  <strong>{c.etiquetaRol}</strong>
                  <span>
                    {c.nombre} · @{c.usuario || c.id}
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
              setAccessToken(null)
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

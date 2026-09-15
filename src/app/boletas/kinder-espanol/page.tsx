'use client'

import ThemeToggle from '@/components/ThemeToggle'
import ProtectedRoute from '@/components/ProtectedRoute'
import {
  KINDER_ES_GRADOS,
  KINDER_ES_GRUPOS,
  type KinderEsGrado,
} from '@/lib/boletasKinderEsCatalog'
import { ArrowLeft, LogOut, Printer, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import './kinder-espanol.css'

type Me = {
  role: 'maestro' | 'admin'
  id: number
  nombre: string
  usuario: string
  cicloActual: number
  ciclos: { valor: number; etiqueta: string }[]
  envOk: boolean
}

type AlumnoLista = {
  alumno_id: number
  alumno_ref: number | null
  nombre: string
  grupo_letra: string
}

type IndicadorCaptura = {
  id: number
  nombre: string
  orden: number
  calificacion: string
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || `Error ${res.status}`)
  return data as T
}

function LoginPanel({ onOk }: { onOk: () => void }) {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await apiJson('/api/boletas-secundaria/auth/login', {
        method: 'POST',
        body: JSON.stringify({ usuario, password }),
      })
      onOk()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="ke-login ke-paper" onSubmit={submit}>
      <h2>Acceso Kinder · Español</h2>
      <p>Misma cuenta de maestros / admin del sistema de boletas.</p>
      <label>
        Usuario
        <input
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          required
        />
      </label>
      <label>
        Contraseña
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      {error ? <p className="ke-msg is-error">{error}</p> : null}
      <button type="submit" className="ke-btn primary" disabled={loading}>
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}

function KinderEsApp() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [boot, setBoot] = useState(true)
  const [grado, setGrado] = useState<KinderEsGrado>(1)
  const [grupo, setGrupo] = useState<(typeof KINDER_ES_GRUPOS)[number]>('A')
  const [bimestre, setBimestre] = useState(1)
  const [ciclo, setCiclo] = useState(0)
  const [alumnos, setAlumnos] = useState<AlumnoLista[]>([])
  const [alumnoId, setAlumnoId] = useState<number | null>(null)
  const [indicadores, setIndicadores] = useState<IndicadorCaptura[]>([])
  const [alumnoNombre, setAlumnoNombre] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)

  const refreshMe = useCallback(async () => {
    try {
      const data = await apiJson<Me>('/api/boletas-secundaria/auth/me')
      setMe(data)
      setCiclo((c) => c || data.cicloActual)
    } catch {
      setMe(null)
    } finally {
      setBoot(false)
    }
  }, [])

  useEffect(() => {
    void refreshMe()
  }, [refreshMe])

  async function cargarAlumnos() {
    if (!ciclo) return
    setBusy(true)
    setMsg('')
    setErr(false)
    setAlumnoId(null)
    setIndicadores([])
    try {
      const q = new URLSearchParams({
        grado: String(grado),
        grupo,
        ciclo: String(ciclo),
      })
      const d = await apiJson<{ alumnos: AlumnoLista[] }>(
        `/api/boletas-kinder-espanol/alumnos?${q}`
      )
      setAlumnos(d.alumnos)
      if (!d.alumnos.length) {
        setMsg('No hay alumnos con esos filtros.')
      }
    } catch (e) {
      setErr(true)
      setMsg(e instanceof Error ? e.message : 'Error al listar')
      setAlumnos([])
    } finally {
      setBusy(false)
    }
  }

  async function abrirCaptura(id: number) {
    if (!ciclo) return
    setBusy(true)
    setMsg('')
    setErr(false)
    setAlumnoId(id)
    try {
      const q = new URLSearchParams({
        alumnoId: String(id),
        bimestre: String(bimestre),
        ciclo: String(ciclo),
      })
      const d = await apiJson<{
        alumno: { nombre: string }
        indicadores: IndicadorCaptura[]
      }>(`/api/boletas-kinder-espanol/captura?${q}`)
      setAlumnoNombre(d.alumno.nombre)
      setIndicadores(d.indicadores)
    } catch (e) {
      setErr(true)
      setMsg(e instanceof Error ? e.message : 'Error al cargar captura')
      setIndicadores([])
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (alumnoId && ciclo) {
      void abrirCaptura(alumnoId)
    }
    // Recargar captura al cambiar trimestre/ciclo
    // eslint-disable-next-line react-hooks/exhaustive-deps -- abrirCaptura usa estado actual
  }, [bimestre, ciclo])

  async function guardar() {
    if (!alumnoId || !ciclo) return
    setBusy(true)
    setMsg('')
    setErr(false)
    try {
      const valores: Record<number, string> = {}
      for (const ind of indicadores) {
        valores[ind.id] = ind.calificacion
      }
      const d = await apiJson<{ saved: number }>('/api/boletas-kinder-espanol/captura', {
        method: 'PUT',
        body: JSON.stringify({ alumnoId, bimestre, ciclo, valores }),
      })
      setMsg(`Guardado (${d.saved} indicadores).`)
    } catch (e) {
      setErr(true)
      setMsg(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setBusy(false)
    }
  }

  function abrirPdf() {
    if (!alumnoId || !ciclo) return
    const q = new URLSearchParams({
      alumnoId: String(alumnoId),
      bimestre: String(bimestre),
      ciclo: String(ciclo),
    })
    window.open(`/api/boletas-kinder-espanol/pdf?${q}`, '_blank', 'noopener,noreferrer')
  }

  async function logout() {
    try {
      await apiJson('/api/boletas-secundaria/auth/logout', { method: 'POST' })
    } catch {
      /* ignore */
    }
    setMe(null)
  }

  if (boot) {
    return <p className="ke-boot">Cargando…</p>
  }

  if (!me) {
    return (
      <>
        <header className="ke-top">
          <button type="button" className="ke-back" onClick={() => router.push('/boletas')}>
            <ArrowLeft size={15} aria-hidden />
            Boletas
          </button>
          <p className="ke-school">Winston Churchill</p>
          <div className="ke-spacer" />
          <ThemeToggle />
        </header>
        <main className="ke-main">
          <h1 className="ke-title">Kinder · Español</h1>
          <p className="ke-lead">Captura de indicadores por trimestre.</p>
          <LoginPanel onOk={() => void refreshMe()} />
        </main>
      </>
    )
  }

  return (
    <>
      <header className="ke-top">
        <button type="button" className="ke-back" onClick={() => router.push('/boletas')}>
          <ArrowLeft size={15} aria-hidden />
          Boletas
        </button>
        <p className="ke-school">Winston Churchill</p>
        <div className="ke-spacer" />
        <span className="ke-user" title={me.nombre}>
          {me.nombre}
        </span>
        <button type="button" className="ke-btn ghost" onClick={() => void logout()} aria-label="Salir">
          <LogOut size={16} aria-hidden />
        </button>
        <ThemeToggle />
      </header>

      <main className="ke-main">
        <h1 className="ke-title">Kinder · Español</h1>
        <p className="ke-lead">
          Calificaciones en texto libre · K1–K3 · trimestres 1–3
          {!me.envOk ? ' · aviso: falta configurar InsForge boletas' : ''}
        </p>
        {msg ? <p className={`ke-msg${err ? ' is-error' : ''}`}>{msg}</p> : null}

        <section className="ke-paper">
          <div className="ke-filters">
            <label>
              Grado
              <select
                value={grado}
                onChange={(e) => setGrado(Number(e.target.value) as KinderEsGrado)}
              >
                {KINDER_ES_GRADOS.map((g) => (
                  <option key={g.valor} value={g.valor}>
                    {g.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Grupo
              <select
                value={grupo}
                onChange={(e) => setGrupo(e.target.value as (typeof KINDER_ES_GRUPOS)[number])}
              >
                {KINDER_ES_GRUPOS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trimestre
              <select value={bimestre} onChange={(e) => setBimestre(Number(e.target.value))}>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
            <label>
              Ciclo
              <select value={ciclo || ''} onChange={(e) => setCiclo(Number(e.target.value))}>
                {me.ciclos.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="ke-btn primary"
              disabled={busy || !ciclo}
              onClick={() => void cargarAlumnos()}
            >
              Listar
            </button>
          </div>

          <div className="ke-layout">
            <aside>
              {alumnos.length === 0 ? (
                <p className="ke-empty">Elige filtros y pulsa Listar.</p>
              ) : (
                <ul className="ke-list">
                  {alumnos.map((a) => (
                    <li key={a.alumno_id}>
                      <button
                        type="button"
                        className={alumnoId === a.alumno_id ? 'is-active' : undefined}
                        onClick={() => void abrirCaptura(a.alumno_id)}
                      >
                        {a.nombre}
                        <span className="ke-list-meta">
                          Ref {String(a.alumno_ref ?? '').padStart(5, '0')} · {a.grupo_letra}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </aside>

            <div className="ke-form">
              {!alumnoId || !indicadores.length ? (
                <p className="ke-empty">Selecciona un alumno para capturar.</p>
              ) : (
                <>
                  <div className="ke-form-head">
                    <h2>{alumnoNombre}</h2>
                    <div className="ke-actions">
                      <button
                        type="button"
                        className="ke-btn primary"
                        disabled={busy}
                        onClick={() => void guardar()}
                      >
                        <Save size={16} aria-hidden />
                        Guardar
                      </button>
                      <button type="button" className="ke-btn" disabled={busy} onClick={abrirPdf}>
                        <Printer size={16} aria-hidden />
                        PDF
                      </button>
                    </div>
                  </div>
                  <div className="ke-fields">
                    {indicadores.map((ind) => (
                      <div className="ke-field" key={ind.id}>
                        <label htmlFor={`ke-ind-${ind.id}`}>{ind.nombre}</label>
                        <input
                          id={`ke-ind-${ind.id}`}
                          value={ind.calificacion}
                          maxLength={40}
                          onChange={(e) => {
                            const v = e.target.value
                            setIndicadores((prev) =>
                              prev.map((x) =>
                                x.id === ind.id ? { ...x, calificacion: v } : x
                              )
                            )
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  )
}

export default function BoletasKinderEspanolPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <div className="ke-page">
        <KinderEsApp />
      </div>
    </ProtectedRoute>
  )
}

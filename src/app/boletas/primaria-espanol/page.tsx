'use client'

import ThemeToggle from '@/components/ThemeToggle'
import ProtectedRoute from '@/components/ProtectedRoute'
import {
  PRIMARIA_ES_BLOQUES,
  PRIMARIA_ES_GRADOS,
  PRIMARIA_ES_GRUPOS,
  type PrimariaEsGrado,
} from '@/lib/boletasPrimariaEsCatalog'
import { cicloEscolarActualBoletas, etiquetaCicloBoletas, opcionesCicloBoletas } from '@/lib/boletasCiclo'
import { ArrowLeft, LogOut, Printer, Save, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import './primaria-espanol.css'

type Me = {
  role: 'maestro' | 'admin'
  id: number
  nombre: string
  usuario: string
  cicloActual?: number
  ciclos?: { valor: number; etiqueta: string }[]
  envOk?: boolean
}

type Alumno = {
  alumno_id: number
  alumno_ref: number | null
  nombre: string
  grupo_letra: string
}

type MateriaFila = {
  clave: string
  nombre: string
  calificacion: string
}

type BloqueFila = {
  id: string
  etiqueta: string
  materias: MateriaFila[]
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
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
      await api('/api/boletas-secundaria/auth/login', {
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
    <form className="pe-login pe-paper" onSubmit={submit}>
      <h2>Primaria · Español</h2>
      <p>Usa las mismas credenciales del sistema de boletas (admin o maestro).</p>
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
      {error && <p className="pe-msg is-error">{error}</p>}
      <button type="submit" className="pe-btn primary" disabled={loading}>
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}

function PrimariaEsApp() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [boot, setBoot] = useState(true)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const cicloDefault = cicloEscolarActualBoletas()
  const [grado, setGrado] = useState<PrimariaEsGrado>(1)
  const [grupo, setGrupo] = useState<(typeof PRIMARIA_ES_GRUPOS)[number]>('A')
  const [bimestre, setBimestre] = useState(1)
  const [ciclo, setCiclo] = useState(cicloDefault)
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [alumnoId, setAlumnoId] = useState<number | null>(null)
  const [bloques, setBloques] = useState<BloqueFila[]>([])
  const [alumnoNombre, setAlumnoNombre] = useState('')
  const [loadingList, setLoadingList] = useState(false)
  const [loadingCap, setLoadingCap] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  const refreshMe = useCallback(async () => {
    try {
      const data = await api<Me>('/api/boletas-secundaria/auth/me')
      setMe(data)
      if (data.cicloActual) setCiclo(data.cicloActual)
    } catch {
      setMe(null)
    } finally {
      setBoot(false)
    }
  }, [])

  useEffect(() => {
    void refreshMe()
  }, [refreshMe])

  const cargarAlumnos = useCallback(async () => {
    setLoadingList(true)
    setErr('')
    setMsg('')
    try {
      const data = await api<{ alumnos: Alumno[] }>(
        `/api/boletas-primaria-espanol/alumnos?grado=${grado}&grupo=${grupo}&ciclo=${ciclo}`
      )
      setAlumnos(data.alumnos ?? [])
      setAlumnoId(null)
      setBloques([])
      setAlumnoNombre('')
      if (!(data.alumnos ?? []).length) {
        setMsg('No hay alumnos para ese grado/grupo/ciclo.')
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al listar')
      setAlumnos([])
    } finally {
      setLoadingList(false)
    }
  }, [grado, grupo, ciclo])

  const abrirCaptura = useCallback(
    async (id: number) => {
      setLoadingCap(true)
      setErr('')
      setMsg('')
      setAlumnoId(id)
      try {
        const data = await api<{
          alumno: Alumno
          bloques: BloqueFila[]
        }>(
          `/api/boletas-primaria-espanol/captura?alumnoId=${id}&bimestre=${bimestre}&ciclo=${ciclo}`
        )
        setAlumnoNombre(data.alumno.nombre)
        setBloques(
          (data.bloques ?? []).map((b) => ({
            id: b.id,
            etiqueta: b.etiqueta,
            materias: (b.materias ?? []).map((m) => ({
              clave: m.clave,
              nombre: m.nombre,
              calificacion: m.calificacion ?? '',
            })),
          }))
        )
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Error al cargar captura')
        setBloques([])
      } finally {
        setLoadingCap(false)
      }
    },
    [bimestre, ciclo]
  )

  useEffect(() => {
    if (alumnoId == null) return
    void abrirCaptura(alumnoId)
  }, [bimestre, ciclo, alumnoId, abrirCaptura])

  async function guardar() {
    if (alumnoId == null) return
    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const valores: Record<string, string> = {}
      for (const b of bloques) {
        for (const m of b.materias) valores[m.clave] = m.calificacion
      }
      await api('/api/boletas-primaria-espanol/captura', {
        method: 'PUT',
        body: JSON.stringify({ alumnoId, bimestre, ciclo, valores }),
      })
      setMsg('Calificaciones guardadas.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  function abrirPdf() {
    if (alumnoId == null) return
    window.open(
      `/api/boletas-primaria-espanol/pdf?alumnoId=${alumnoId}&bimestre=${bimestre}&ciclo=${ciclo}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  
  async function enviar() {
    if (alumnoId == null) return
    setSending(true)
    setErr('')
    setMsg('')
    try {
      const data = await api<{ emails: string[] }>('/api/boletas-envio', {
        method: 'POST',
        body: JSON.stringify({
          modulo: 'primaria-es',
          alumnoId,
          bimestre,
          ciclo,
        }),
      })
      setMsg(`Boleta enviada a: ${data.emails.join(', ')}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al enviar')
    } finally {
      setSending(false)
    }
  }

async function logout() {
    await api('/api/boletas-secundaria/auth/logout', { method: 'POST' }).catch(() => null)
    setMe(null)
  }

  const ciclosOpts = me?.ciclos?.length
    ? me.ciclos
    : opcionesCicloBoletas(ciclo)

  function tonoBloque(id: string): string | undefined {
    return PRIMARIA_ES_BLOQUES.find((b) => b.id === id)?.tono
  }

  if (boot) {
    return (
      <div className="pe-page">
        <p className="pe-boot">Cargando…</p>
      </div>
    )
  }

  if (!me) {
    return (
      <div className="pe-page">
        <header className="pe-top">
          <button type="button" className="pe-back" onClick={() => router.push('/boletas')}>
            <ArrowLeft size={15} aria-hidden />
            Boletas
          </button>
          <div className="pe-spacer" />
          <ThemeToggle />
        </header>
        <main className="pe-main">
          <LoginPanel onOk={() => void refreshMe()} />
        </main>
      </div>
    )
  }

  return (
    <div className="pe-page">
      <header className="pe-top">
        <button type="button" className="pe-back" onClick={() => router.push('/boletas')}>
          <ArrowLeft size={15} aria-hidden />
          Boletas
        </button>
        <p className="pe-school">Winston Churchill</p>
        <div className="pe-spacer" />
        <span className="pe-user" title={me.usuario}>
          {me.nombre}
        </span>
        <button type="button" className="pe-btn ghost" onClick={() => void logout()} aria-label="Salir">
          <LogOut size={16} aria-hidden />
        </button>
        <ThemeToggle />
      </header>

      <main className="pe-main">
        <h1 className="pe-title">Primaria · Español</h1>
        <p className="pe-lead">
          Captura por bloques · Ciclo {etiquetaCicloBoletas(ciclo)}
        </p>

        {(msg || err) && (
          <p className={`pe-msg${err ? ' is-error' : ''}`} role="status">
            {err || msg}
          </p>
        )}

        <section className="pe-paper">
          <div className="pe-filters">
            <label>
              Grado
              <select
                value={grado}
                onChange={(e) => setGrado(Number(e.target.value) as PrimariaEsGrado)}
              >
                {PRIMARIA_ES_GRADOS.map((g) => (
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
                onChange={(e) => setGrupo(e.target.value as (typeof PRIMARIA_ES_GRUPOS)[number])}
              >
                {PRIMARIA_ES_GRUPOS.map((g) => (
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
              <select value={ciclo} onChange={(e) => setCiclo(Number(e.target.value))}>
                {ciclosOpts.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="pe-btn primary"
              onClick={() => void cargarAlumnos()}
              disabled={loadingList}
            >
              {loadingList ? 'Buscando…' : 'Listar'}
            </button>
          </div>

          <div className="pe-layout">
            <div>
              {alumnos.length === 0 ? (
                <p className="pe-empty">Elige filtros y pulsa Listar.</p>
              ) : (
                <ul className="pe-list">
                  {alumnos.map((a) => (
                    <li key={a.alumno_id}>
                      <button
                        type="button"
                        className={alumnoId === a.alumno_id ? 'is-active' : undefined}
                        onClick={() => void abrirCaptura(a.alumno_id)}
                      >
                        {a.nombre}
                        <span className="pe-list-meta">
                          Ref {String(a.alumno_ref ?? '').padStart(5, '0')} · {a.grupo_letra}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              {alumnoId == null ? (
                <p className="pe-empty">Selecciona un alumno para capturar.</p>
              ) : loadingCap ? (
                <p className="pe-empty">Cargando captura…</p>
              ) : (
                <div className="pe-form">
                  <div className="pe-form-head">
                    <h2>{alumnoNombre}</h2>
                    <div className="pe-actions">
                      <button
                        type="button"
                        className="pe-btn primary"
                        onClick={() => void guardar()}
                        disabled={saving}
                      >
                        <Save size={16} aria-hidden />
                        {saving ? 'Guardando…' : 'Guardar'}
                      </button>
                      <button type="button" className="pe-btn" onClick={abrirPdf}>
                        <Printer size={16} aria-hidden />
                        PDF
                      </button>
                      <button
                        type="button"
                        className="pe-btn"
                        onClick={() => void enviar()}
                        disabled={sending}
                      >
                        <Send size={16} aria-hidden />
                        {sending ? 'Enviando…' : 'Enviar'}
                      </button>
                    </div>
                  </div>

                  {bloques.map((bloque) => (
                    <section key={bloque.id} className="pe-block">
                      <h3
                        className={`pe-block-title${tonoBloque(bloque.id) === 'warn' ? ' is-warn' : ''}`}
                      >
                        {bloque.etiqueta}
                      </h3>
                      <div className="pe-fields">
                        {bloque.materias.map((mat) => (
                          <div key={mat.clave} className="pe-field">
                            <label htmlFor={`mat-${mat.clave}`}>{mat.nombre}</label>
                            <input
                              id={`mat-${mat.clave}`}
                              value={mat.calificacion}
                              onChange={(e) => {
                                const v = e.target.value
                                setBloques((prev) =>
                                  prev.map((b) =>
                                    b.id !== bloque.id
                                      ? b
                                      : {
                                          ...b,
                                          materias: b.materias.map((x) =>
                                            x.clave === mat.clave
                                              ? { ...x, calificacion: v }
                                              : x
                                          ),
                                        }
                                  )
                                )
                              }}
                              maxLength={40}
                              autoComplete="off"
                              inputMode="decimal"
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default function BoletasPrimariaEspanolPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <PrimariaEsApp />
    </ProtectedRoute>
  )
}

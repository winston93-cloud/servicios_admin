'use client'

import ThemeToggle from '@/components/ThemeToggle'
import ProtectedRoute from '@/components/ProtectedRoute'
import {
  PRIMARIA_EN_ESCALA_HINT,
  PRIMARIA_EN_GRADOS,
  PRIMARIA_EN_GRUPOS,
  type PrimariaEnGrado,
} from '@/lib/boletasPrimariaEnCatalog'
import { cicloEscolarActualBoletas, etiquetaCicloBoletas, opcionesCicloBoletas } from '@/lib/boletasCiclo'
import { ArrowLeft, LogOut, Printer, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import './primaria-ingles.css'

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

type IndicadorFila = {
  id: number
  nombre: string
  calificacion: string
  mindfulnessColor?: boolean
}

type Attendance = {
  school_days: string
  days_absent: string
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
    <form className="pi-login pi-paper" onSubmit={submit}>
      <h2>Primaria · Inglés</h2>
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
      {error && <p className="pi-msg is-error">{error}</p>}
      <button type="submit" className="pi-btn primary" disabled={loading}>
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}

function FieldsBlock({
  prefix,
  filas,
  onChange,
}: {
  prefix: string
  filas: IndicadorFila[]
  onChange: (id: number, value: string) => void
}) {
  return (
    <div className="pi-fields">
      {filas.map((ind) => (
        <div key={`${prefix}-${ind.id}`} className="pi-field">
          <label htmlFor={`${prefix}-${ind.id}`}>
            {ind.nombre}
            {ind.mindfulnessColor ? ' · color' : ''}
          </label>
          <input
            id={`${prefix}-${ind.id}`}
            value={ind.calificacion}
            onChange={(e) => onChange(ind.id, e.target.value)}
            maxLength={40}
            autoComplete="off"
          />
        </div>
      ))}
    </div>
  )
}

function PrimariaEnApp() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [boot, setBoot] = useState(true)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const cicloDefault = cicloEscolarActualBoletas()
  const [grado, setGrado] = useState<PrimariaEnGrado>(1)
  const [grupo, setGrupo] = useState<(typeof PRIMARIA_EN_GRUPOS)[number]>('A')
  const [bimestre, setBimestre] = useState(1)
  const [ciclo, setCiclo] = useState(cicloDefault)
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [alumnoId, setAlumnoId] = useState<number | null>(null)
  const [subjects, setSubjects] = useState<IndicadorFila[]>([])
  const [skills, setSkills] = useState<IndicadorFila[]>([])
  const [attendance, setAttendance] = useState<Attendance>({
    school_days: '',
    days_absent: '',
  })
  const [promedio, setPromedio] = useState('')
  const [alumnoNombre, setAlumnoNombre] = useState('')
  const [loadingList, setLoadingList] = useState(false)
  const [loadingCap, setLoadingCap] = useState(false)
  const [saving, setSaving] = useState(false)

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
        `/api/boletas-primaria-ingles/alumnos?grado=${grado}&grupo=${grupo}&ciclo=${ciclo}`
      )
      setAlumnos(data.alumnos ?? [])
      setAlumnoId(null)
      setSubjects([])
      setSkills([])
      setAttendance({ school_days: '', days_absent: '' })
      setPromedio('')
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
          subjects: IndicadorFila[]
          skills: IndicadorFila[]
          attendance: Attendance
          promedioSugerido?: string
        }>(
          `/api/boletas-primaria-ingles/captura?alumnoId=${id}&bimestre=${bimestre}&ciclo=${ciclo}`
        )
        setAlumnoNombre(data.alumno.nombre)
        setSubjects(
          (data.subjects ?? []).map((i) => ({
            id: i.id,
            nombre: i.nombre,
            calificacion: i.calificacion ?? '',
            mindfulnessColor: i.mindfulnessColor,
          }))
        )
        setSkills(
          (data.skills ?? []).map((i) => ({
            id: i.id,
            nombre: i.nombre,
            calificacion: i.calificacion ?? '',
          }))
        )
        setAttendance({
          school_days: data.attendance?.school_days ?? '',
          days_absent: data.attendance?.days_absent ?? '',
        })
        setPromedio(data.promedioSugerido ?? '')
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Error al cargar captura')
        setSubjects([])
        setSkills([])
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
      const mapVals = (rows: IndicadorFila[]) => {
        const valores: Record<number, string> = {}
        for (const ind of rows) valores[ind.id] = ind.calificacion
        return valores
      }
      await api('/api/boletas-primaria-ingles/captura', {
        method: 'PUT',
        body: JSON.stringify({
          alumnoId,
          bimestre,
          ciclo,
          subjects: mapVals(subjects),
          skills: mapVals(skills),
          attendance,
        }),
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
      `/api/boletas-primaria-ingles/pdf?alumnoId=${alumnoId}&bimestre=${bimestre}&ciclo=${ciclo}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  async function logout() {
    await api('/api/boletas-secundaria/auth/logout', { method: 'POST' }).catch(() => null)
    setMe(null)
  }

  const ciclosOpts = me?.ciclos?.length ? me.ciclos : opcionesCicloBoletas(ciclo)

  if (boot) {
    return (
      <div className="pi-page">
        <p className="pi-boot">Cargando…</p>
      </div>
    )
  }

  if (!me) {
    return (
      <div className="pi-page">
        <header className="pi-top">
          <button type="button" className="pi-back" onClick={() => router.push('/boletas')}>
            <ArrowLeft size={15} aria-hidden />
            Boletas
          </button>
          <div className="pi-spacer" />
          <ThemeToggle />
        </header>
        <main className="pi-main">
          <LoginPanel onOk={() => void refreshMe()} />
        </main>
      </div>
    )
  }

  return (
    <div className="pi-page">
      <header className="pi-top">
        <button type="button" className="pi-back" onClick={() => router.push('/boletas')}>
          <ArrowLeft size={15} aria-hidden />
          Boletas
        </button>
        <p className="pi-school">Winston Churchill</p>
        <div className="pi-spacer" />
        <span className="pi-user" title={me.usuario}>
          {me.nombre}
        </span>
        <button type="button" className="pi-btn ghost" onClick={() => void logout()} aria-label="Salir">
          <LogOut size={16} aria-hidden />
        </button>
        <ThemeToggle />
      </header>

      <main className="pi-main">
        <h1 className="pi-title">Primaria · Inglés</h1>
        <p className="pi-lead">
          English Primary · Ciclo {etiquetaCicloBoletas(ciclo)}
        </p>

        {(msg || err) && (
          <p className={`pi-msg${err ? ' is-error' : ''}`} role="status">
            {err || msg}
          </p>
        )}

        <section className="pi-paper">
          <div className="pi-filters">
            <label>
              Grado
              <select
                value={grado}
                onChange={(e) => setGrado(Number(e.target.value) as PrimariaEnGrado)}
              >
                {PRIMARIA_EN_GRADOS.map((g) => (
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
                onChange={(e) => setGrupo(e.target.value as (typeof PRIMARIA_EN_GRUPOS)[number])}
              >
                {PRIMARIA_EN_GRUPOS.map((g) => (
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
              className="pi-btn primary"
              onClick={() => void cargarAlumnos()}
              disabled={loadingList}
            >
              {loadingList ? 'Buscando…' : 'Listar'}
            </button>
          </div>

          <div className="pi-layout">
            <div>
              {alumnos.length === 0 ? (
                <p className="pi-empty">Elige filtros y pulsa Listar.</p>
              ) : (
                <ul className="pi-list">
                  {alumnos.map((a) => (
                    <li key={a.alumno_id}>
                      <button
                        type="button"
                        className={alumnoId === a.alumno_id ? 'is-active' : undefined}
                        onClick={() => void abrirCaptura(a.alumno_id)}
                      >
                        {a.nombre}
                        <span className="pi-list-meta">
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
                <p className="pi-empty">Selecciona un alumno para capturar.</p>
              ) : loadingCap ? (
                <p className="pi-empty">Cargando captura…</p>
              ) : (
                <div className="pi-form">
                  <div className="pi-form-head">
                    <h2>{alumnoNombre}</h2>
                    <div className="pi-actions">
                      <button
                        type="button"
                        className="pi-btn primary"
                        onClick={() => void guardar()}
                        disabled={saving}
                      >
                        <Save size={16} aria-hidden />
                        {saving ? 'Guardando…' : 'Guardar'}
                      </button>
                      <button type="button" className="pi-btn" onClick={abrirPdf}>
                        <Printer size={16} aria-hidden />
                        PDF
                      </button>
                    </div>
                  </div>

                  <p className="pi-hint">{PRIMARIA_EN_ESCALA_HINT}</p>

                  <div className="pi-section">
                    <h3>Subjects</h3>
                    <FieldsBlock
                      prefix="sub"
                      filas={subjects}
                      onChange={(id, value) =>
                        setSubjects((prev) =>
                          prev.map((x) => (x.id === id ? { ...x, calificacion: value } : x))
                        )
                      }
                    />
                    {promedio ? (
                      <p className="pi-hint">
                        Average sugerido (sin Mindfulness/Computer/Faith): {promedio}
                      </p>
                    ) : null}
                  </div>
                  <div className="pi-section">
                    <h3>Behavioral skills</h3>
                    <FieldsBlock
                      prefix="sk"
                      filas={skills}
                      onChange={(id, value) =>
                        setSkills((prev) =>
                          prev.map((x) => (x.id === id ? { ...x, calificacion: value } : x))
                        )
                      }
                    />
                  </div>
                  <div className="pi-section">
                    <h3>Attendance</h3>
                    <div className="pi-fields">
                      <div className="pi-field">
                        <label htmlFor="att-school">School days</label>
                        <input
                          id="att-school"
                          value={attendance.school_days}
                          onChange={(e) =>
                            setAttendance((a) => ({ ...a, school_days: e.target.value }))
                          }
                          maxLength={20}
                          autoComplete="off"
                        />
                      </div>
                      <div className="pi-field">
                        <label htmlFor="att-absent">Days absent</label>
                        <input
                          id="att-absent"
                          value={attendance.days_absent}
                          onChange={(e) =>
                            setAttendance((a) => ({ ...a, days_absent: e.target.value }))
                          }
                          maxLength={20}
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default function BoletasPrimariaInglesPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <PrimariaEnApp />
    </ProtectedRoute>
  )
}

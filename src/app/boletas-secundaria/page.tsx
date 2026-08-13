'use client'

import ThemeToggle from '@/components/ThemeToggle'
import ProtectedRoute from '@/components/ProtectedRoute'
import { ArrowLeft, LogOut, Printer, Save, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import './boletas-secundaria.css'

type Role = 'maestro' | 'admin'

type Me = {
  role: Role
  id: number
  nombre: string
  usuario: string
  cicloActual: number
  ciclos: { valor: number; etiqueta: string }[]
  bimestre: { bimestre_activo: number; bimestre_etiqueta: string | null } | null
  envOk: boolean
}

type Asignacion = {
  grupo_id: number
  materia_id: number
  materia_nombre: string
  materia_grado: number
  grupo_letra: string
  maestro_id?: number
}

type AlumnoFila = {
  alumno_id: number
  alumno_ref: number | null
  nombre: string
  grupo_letra: string
  calificacion: string | null
  inasistencia: number
  conducta: string | null
  comprension: string | null
}

type Tab = 'captura' | 'admin' | 'reportes' | 'envio'

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
    <form className="boletas-login" onSubmit={submit}>
      <h2>Acceso boletas secundaria</h2>
      <p className="boletas-muted">Maestro o administrador del sistema de boletas.</p>
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
      {error ? <p className="boletas-error">{error}</p> : null}
      <button type="submit" className="boletas-btn primary" disabled={loading}>
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}

function BoletasApp() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [boot, setBoot] = useState(true)
  const [tab, setTab] = useState<Tab>('captura')
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [asigKey, setAsigKey] = useState('')
  const [ciclo, setCiclo] = useState(0)
  const [periodo, setPeriodo] = useState(1)
  const [alumnos, setAlumnos] = useState<AlumnoFila[]>([])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  // Admin state
  const [materias, setMaterias] = useState<Record<string, unknown>[]>([])
  const [maestros, setMaestros] = useState<Record<string, unknown>[]>([])
  const [grupos, setGrupos] = useState<Record<string, unknown>[]>([])
  const [progreso, setProgreso] = useState<
    { materia_nombre: string; materia_grado: number; grupo_letra: string; capturados: number; esperados: number; pct: number }[]
  >([])
  const [nuevaMateria, setNuevaMateria] = useState({ materia_nombre: '', materia_grado: 1, materia_orden: 0 })
  const [periodoAdmin, setPeriodoAdmin] = useState(1)

  // Reportes
  const [repFilas, setRepFilas] = useState<Record<string, unknown>[]>([])
  const [repGrado, setRepGrado] = useState(0)
  const [repTipo, setRepTipo] = useState<'alumnos' | 'materias'>('alumnos')

  // Email
  const [emailDry, setEmailDry] = useState<string>('')

  const refreshMe = useCallback(async () => {
    try {
      const data = await api<Me>('/api/boletas-secundaria/auth/me')
      setMe(data)
      setCiclo((c) => c || data.cicloActual)
      setPeriodo(data.bimestre?.bimestre_activo || 1)
      setPeriodoAdmin(data.bimestre?.bimestre_activo || 1)
    } catch {
      setMe(null)
    } finally {
      setBoot(false)
    }
  }, [])

  useEffect(() => {
    void refreshMe()
  }, [refreshMe])

  useEffect(() => {
    if (!me) return
    void api<{ asignaciones: Asignacion[] }>('/api/boletas-secundaria/maestro/asignaciones')
      .then((d) => {
        setAsignaciones(d.asignaciones)
        if (d.asignaciones[0] && !asigKey) {
          const a = d.asignaciones[0]
          setAsigKey(`${a.materia_id}|${a.grupo_letra}`)
        }
      })
      .catch(() => setAsignaciones([]))
  }, [me, asigKey])

  const asig = asignaciones.find((a) => `${a.materia_id}|${a.grupo_letra}` === asigKey)

  async function cargarCaptura() {
    if (!asig || !ciclo) return
    setBusy(true)
    setMsg('')
    try {
      const q = new URLSearchParams({
        materiaId: String(asig.materia_id),
        grupo: asig.grupo_letra || 'ABC',
        periodo: String(periodo),
        ciclo: String(ciclo),
      })
      const d = await api<{ alumnos: AlumnoFila[] }>(`/api/boletas-secundaria/captura?${q}`)
      setAlumnos(d.alumnos)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setBusy(false)
    }
  }

  async function guardarCaptura() {
    if (!asig) return
    setBusy(true)
    setMsg('')
    try {
      await api('/api/boletas-secundaria/captura', {
        method: 'POST',
        body: JSON.stringify({
          materiaId: asig.materia_id,
          periodo,
          ciclo,
          filas: alumnos.map((a) => ({
            alumno_id: a.alumno_id,
            calificacion: a.calificacion,
            inasistencia: a.inasistencia,
            conducta: a.conducta,
            comprension: a.comprension,
          })),
        }),
      })
      setMsg('Guardado correctamente')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setBusy(false)
    }
  }

  async function loadAdmin() {
    if (me?.role !== 'admin') return
    try {
      const [m, ma, g, p] = await Promise.all([
        api<{ materias: Record<string, unknown>[] }>('/api/boletas-secundaria/admin/materias'),
        api<{ maestros: Record<string, unknown>[] }>('/api/boletas-secundaria/admin/maestros'),
        api<{ grupos: Record<string, unknown>[] }>('/api/boletas-secundaria/admin/grupos'),
        api<{ progreso: typeof progreso }>(
          `/api/boletas-secundaria/admin/progreso?ciclo=${ciclo}&periodo=${periodoAdmin}`
        ),
      ])
      setMaterias(m.materias)
      setMaestros(ma.maestros)
      setGrupos(g.grupos)
      setProgreso(p.progreso)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error admin')
    }
  }

  useEffect(() => {
    if (tab === 'admin' && me?.role === 'admin') void loadAdmin()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, me, ciclo, periodoAdmin])

  async function loadReportes() {
    setBusy(true)
    try {
      const q = new URLSearchParams({
        tipo: repTipo,
        ciclo: String(ciclo),
        periodo: String(periodo),
      })
      if (repGrado) q.set('grado', String(repGrado))
      const d = await api<{ filas: Record<string, unknown>[] }>(
        `/api/boletas-secundaria/reportes/promedios?${q}`
      )
      setRepFilas(d.filas)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error reporte')
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    await api('/api/boletas-secundaria/auth/logout', { method: 'POST' })
    setMe(null)
  }

  if (boot) {
    return <p className="boletas-muted">Cargando…</p>
  }

  if (!me) {
    return (
      <div className="boletas-shell">
        <header className="boletas-header">
          <button type="button" className="servicios-back-btn" onClick={() => router.push('/becas')}>
            <ArrowLeft size={16} aria-hidden />
            Hub Becas
          </button>
          <ThemeToggle />
        </header>
        <LoginPanel onOk={() => void refreshMe()} />
      </div>
    )
  }

  return (
    <div className="boletas-shell">
      <header className="boletas-header">
        <button type="button" className="servicios-back-btn" onClick={() => router.push('/becas')}>
          <ArrowLeft size={16} aria-hidden />
          Hub Becas
        </button>
        <div className="boletas-header-meta">
          <strong>{me.nombre}</strong>
          <span className="boletas-badge">{me.role}</span>
          {!me.envOk ? <span className="boletas-error">Sin InsForge boletas</span> : null}
        </div>
        <ThemeToggle />
        <button type="button" className="boletas-btn ghost" onClick={() => void logout()}>
          <LogOut size={16} aria-hidden />
          Salir
        </button>
      </header>

      <div className="boletas-heading">
        <h1>Boletas secundaria</h1>
        <p>Captura, consulta histórica, PDF y envío — ciclo {ciclo || me.cicloActual}</p>
      </div>

      <nav className="boletas-tabs" aria-label="Secciones">
        {(
          [
            ['captura', 'Captura'],
            ...(me.role === 'admin' ? ([['admin', 'Admin']] as const) : []),
            ['reportes', 'Reportes'],
            ...(me.role === 'admin' ? ([['envio', 'Envío']] as const) : []),
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {msg ? <p className="boletas-msg">{msg}</p> : null}

      {tab === 'captura' ? (
        <section className="boletas-panel">
          <div className="boletas-filters">
            <label>
              Materia / grupo
              <select value={asigKey} onChange={(e) => setAsigKey(e.target.value)}>
                {asignaciones.map((a) => (
                  <option key={`${a.materia_id}|${a.grupo_letra}|${a.grupo_id}`} value={`${a.materia_id}|${a.grupo_letra}`}>
                    {a.materia_nombre} · {a.materia_grado}° · {a.grupo_letra || 'ABC'}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ciclo
              <select value={ciclo} onChange={(e) => setCiclo(Number(e.target.value))}>
                {me.ciclos.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Periodo
              <select value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))}>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
            <button type="button" className="boletas-btn" onClick={() => void cargarCaptura()} disabled={busy}>
              Cargar
            </button>
            <button type="button" className="boletas-btn primary" onClick={() => void guardarCaptura()} disabled={busy || !alumnos.length}>
              <Save size={16} aria-hidden />
              Guardar
            </button>
          </div>

          <div className="boletas-table-wrap">
            <table className="boletas-table">
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Calif.</th>
                  <th>Faltas</th>
                  <th>Conducta</th>
                  <th>Comp. lectora</th>
                  <th>PDF</th>
                </tr>
              </thead>
              <tbody>
                {alumnos.map((a, idx) => (
                  <tr key={a.alumno_id}>
                    <td>
                      <div className="boletas-alumno-cell">
                        <span>{a.nombre}</span>
                        <small>
                          {a.alumno_ref != null ? String(a.alumno_ref).padStart(5, '0') : '—'} · {a.grupo_letra}
                        </small>
                      </div>
                    </td>
                    <td>
                      <input
                        value={a.calificacion ?? ''}
                        onChange={(e) => {
                          const next = [...alumnos]
                          next[idx] = { ...a, calificacion: e.target.value }
                          setAlumnos(next)
                        }}
                        inputMode="decimal"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        value={a.inasistencia}
                        onChange={(e) => {
                          const next = [...alumnos]
                          next[idx] = { ...a, inasistencia: Number(e.target.value) }
                          setAlumnos(next)
                        }}
                      />
                    </td>
                    <td>
                      <input
                        value={a.conducta ?? ''}
                        onChange={(e) => {
                          const next = [...alumnos]
                          next[idx] = { ...a, conducta: e.target.value }
                          setAlumnos(next)
                        }}
                      />
                    </td>
                    <td>
                      <input
                        value={a.comprension ?? ''}
                        onChange={(e) => {
                          const next = [...alumnos]
                          next[idx] = { ...a, comprension: e.target.value }
                          setAlumnos(next)
                        }}
                      />
                    </td>
                    <td>
                      <a
                        className="boletas-btn ghost"
                        href={`/api/boletas-secundaria/pdf?alumnoId=${a.alumno_id}&ciclo=${ciclo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Printer size={16} aria-hidden />
                      </a>
                    </td>
                  </tr>
                ))}
                {!alumnos.length ? (
                  <tr>
                    <td colSpan={6} className="boletas-muted">
                      Selecciona materia y ciclo, luego Cargar.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === 'admin' && me.role === 'admin' ? (
        <section className="boletas-panel boletas-admin">
          <div className="boletas-filters">
            <label>
              Periodo activo
              <select value={periodoAdmin} onChange={(e) => setPeriodoAdmin(Number(e.target.value))}>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
            <button
              type="button"
              className="boletas-btn primary"
              onClick={() =>
                void api('/api/boletas-secundaria/bimestre', {
                  method: 'PUT',
                  body: JSON.stringify({ periodo: periodoAdmin }),
                }).then(() => setMsg(`Periodo activo → ${periodoAdmin}`))
              }
            >
              Aplicar periodo
            </button>
          </div>

          <h3>Nueva materia</h3>
          <div className="boletas-filters">
            <input
              placeholder="Nombre"
              value={nuevaMateria.materia_nombre}
              onChange={(e) => setNuevaMateria({ ...nuevaMateria, materia_nombre: e.target.value })}
            />
            <select
              value={nuevaMateria.materia_grado}
              onChange={(e) => setNuevaMateria({ ...nuevaMateria, materia_grado: Number(e.target.value) })}
            >
              <option value={1}>7mo</option>
              <option value={2}>8vo</option>
              <option value={3}>9no</option>
            </select>
            <button
              type="button"
              className="boletas-btn"
              onClick={() =>
                void api('/api/boletas-secundaria/admin/materias', {
                  method: 'POST',
                  body: JSON.stringify(nuevaMateria),
                }).then(() => {
                  setMsg('Materia guardada')
                  void loadAdmin()
                })
              }
            >
              Guardar materia
            </button>
          </div>

          <h3>Progreso de captura</h3>
          <div className="boletas-table-wrap">
            <table className="boletas-table">
              <thead>
                <tr>
                  <th>Materia</th>
                  <th>Grado</th>
                  <th>Grupo</th>
                  <th>Capturados</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {progreso.map((p, i) => (
                  <tr key={i}>
                    <td>{p.materia_nombre}</td>
                    <td>{p.materia_grado}</td>
                    <td>{p.grupo_letra}</td>
                    <td>
                      {p.capturados}/{p.esperados}
                    </td>
                    <td>{p.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="boletas-muted">
            Materias: {materias.length} · Maestros: {maestros.length} · Asignaciones: {grupos.length}
          </p>
        </section>
      ) : null}

      {tab === 'reportes' ? (
        <section className="boletas-panel">
          <div className="boletas-filters">
            <label>
              Tipo
              <select value={repTipo} onChange={(e) => setRepTipo(e.target.value as 'alumnos' | 'materias')}>
                <option value="alumnos">Por alumno</option>
                <option value="materias">Por materia</option>
              </select>
            </label>
            <label>
              Ciclo (histórico)
              <select value={ciclo} onChange={(e) => setCiclo(Number(e.target.value))}>
                {me.ciclos.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Grado
              <select value={repGrado} onChange={(e) => setRepGrado(Number(e.target.value))}>
                <option value={0}>Todos</option>
                <option value={1}>7mo</option>
                <option value={2}>8vo</option>
                <option value={3}>9no</option>
              </select>
            </label>
            <button type="button" className="boletas-btn primary" onClick={() => void loadReportes()} disabled={busy}>
              Consultar
            </button>
          </div>
          <div className="boletas-table-wrap">
            <table className="boletas-table">
              <thead>
                <tr>
                  {repTipo === 'alumnos' ? (
                    <>
                      <th>Alumno</th>
                      <th>Grado</th>
                      <th>Grupo</th>
                      <th>Promedio</th>
                      <th>PDF</th>
                    </>
                  ) : (
                    <>
                      <th>Materia</th>
                      <th>Grado</th>
                      <th>Promedio</th>
                      <th>N</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {repFilas.map((f, i) =>
                  repTipo === 'alumnos' ? (
                    <tr key={i}>
                      <td>{String(f.nombre)}</td>
                      <td>{String(f.grado_etiqueta)}</td>
                      <td>{String(f.grupo_letra)}</td>
                      <td>{f.promedio != null ? Number(f.promedio).toFixed(1) : '—'}</td>
                      <td>
                        <a
                          className="boletas-btn ghost"
                          href={`/api/boletas-secundaria/pdf?alumnoId=${f.alumno_id}&ciclo=${ciclo}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Printer size={16} aria-hidden />
                        </a>
                      </td>
                    </tr>
                  ) : (
                    <tr key={i}>
                      <td>{String(f.materia_nombre)}</td>
                      <td>{String(f.materia_grado)}</td>
                      <td>{f.promedio != null ? Number(f.promedio).toFixed(1) : '—'}</td>
                      <td>{String(f.n)}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === 'envio' && me.role === 'admin' ? (
        <section className="boletas-panel">
          <p className="boletas-muted">
            Envío autenticado a familiares con correo activo (paridad Filtro + BoletaEmail). Requiere MAIL_PASS.
          </p>
          <div className="boletas-filters">
            <label>
              Ciclo
              <select value={ciclo} onChange={(e) => setCiclo(Number(e.target.value))}>
                {me.ciclos.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Grado
              <select value={repGrado} onChange={(e) => setRepGrado(Number(e.target.value))}>
                <option value={0}>Todos</option>
                <option value={1}>7mo</option>
                <option value={2}>8vo</option>
                <option value={3}>9no</option>
              </select>
            </label>
            <button
              type="button"
              className="boletas-btn"
              onClick={() =>
                void api<{ total: number; destinatarios: { nombre: string; emails: string[] }[] }>(
                  '/api/boletas-secundaria/email',
                  {
                    method: 'POST',
                    body: JSON.stringify({
                      ciclo,
                      grado: repGrado || undefined,
                      dryRun: true,
                    }),
                  }
                ).then((d) =>
                  setEmailDry(
                    `Destinatarios: ${d.total}\n` +
                      d.destinatarios
                        .slice(0, 20)
                        .map((x) => `${x.nombre} → ${x.emails.join(', ')}`)
                        .join('\n')
                  )
                )
              }
            >
              Vista previa
            </button>
            <button
              type="button"
              className="boletas-btn primary"
              onClick={() =>
                void api('/api/boletas-secundaria/email', {
                  method: 'POST',
                  body: JSON.stringify({
                    ciclo,
                    grado: repGrado || undefined,
                    dryRun: false,
                    limit: 5,
                  }),
                }).then((d) => setMsg(`Enviados: ${(d as { enviados: number }).enviados}`))
              }
            >
              <Send size={16} aria-hidden />
              Enviar (máx. 5)
            </button>
          </div>
          {emailDry ? <pre className="boletas-pre">{emailDry}</pre> : null}
        </section>
      ) : null}
    </div>
  )
}

export default function BoletasSecundariaPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <div className="dashboard-container facturacion-cfdi-page boletas-secundaria-page">
        <div className="dashboard-home-bg" aria-hidden="true" />
        <div className="dashboard-main">
          <BoletasApp />
        </div>
      </div>
    </ProtectedRoute>
  )
}

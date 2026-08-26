'use client'

import ThemeToggle from '@/components/ThemeToggle'
import type { RacNivelConfig } from '@/lib/rac/racNivelConfig'
import type { RacRolNivel } from '@/lib/rac/racNivelConfig'
import {
  etiquetaRolNivel,
  tabsDeRolNivel,
  tiposCapturaDeRolNivel,
  type RacTabNivel,
} from '@/lib/rac/racPermisosNivel'
import { opcionesMotivo } from '@/lib/racUi'
import { ArrowLeft, LogOut, RefreshCw, Send, Sparkles, Users, UsersRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import '../../dashboard/dashboard-module-card.css'
import '../../boletas-secundaria/boletas-secundaria.css'
import '../reportes-conducta.css'

type Me = {
  role: RacRolNivel
  perfil: number
  id: number
  nombre: string
  usuario: string
  cicloActual: number
  ciclos: { valor: number; etiqueta: string }[]
  etiquetaCiclo: string
}

type Asignacion = {
  grupo_id: number
  materia_id: number
  materia_nombre: string
  materia_grado: number
  grupo_letra: string
  etiqueta_grupo: string
}

type AlumnoFila = {
  alumno_id: number
  alumno_ref: string | number | null
  nombre: string
  grado: number
  grupo: string
  aviso: string
  r1: string
  r2: string
  r3: string
}

type RacNivelAppProps = {
  config: RacNivelConfig
  themeClass: string
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    credentials: 'include',
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

function iniciales(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function ChipFecha({ valor }: { valor: string }) {
  const vacio = !valor || valor === '—' || valor === '-'
  return (
    <span className={vacio ? 'racn-chip racn-chip--empty' : 'racn-chip racn-chip--set'}>
      {vacio ? '—' : valor}
    </span>
  )
}

function LoginPanel({
  config,
  onOk,
}: {
  config: RacNivelConfig
  onOk: () => void
}) {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api(`${config.apiBase}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ usuario, password }),
      })
      onOk()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="racn-login-card" onSubmit={(ev) => void submit(ev)}>
      <p className="racn-login-kicker">Acceso docente · {config.titulo}</p>
      <h2>Ingresar a {config.titulo}</h2>
      <p className="racn-login-lead">
        Maestro(a), Teacher, psicología, {config.etiquetaOperaciones.toLowerCase()} o dirección/coordinación.
        {config.modoGradoGrupo
          ? ' Los docentes entran con su grupo ya asignado — no eligen materia.'
          : ''}
      </p>
      <label>
        Usuario
        <input
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          placeholder="Tu usuario"
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
      {error ? <p className="racn-login-error">{error}</p> : null}
      <button type="submit" className="racn-login-submit" disabled={loading}>
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}

export default function RacNivelApp({ config, themeClass }: RacNivelAppProps) {
  const router = useRouter()
  const [boot, setBoot] = useState(true)
  const [me, setMe] = useState<Me | null>(null)
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [fisica, setFisica] = useState(false)
  const [tab, setTab] = useState<RacTabNivel>('captura')
  const [asigKey, setAsigKey] = useState('')
  const [tipo, setTipo] = useState(1)
  const [filas, setFilas] = useState<AlumnoFila[]>([])
  const [lista, setLista] = useState<Record<string, unknown>[]>([])
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState<AlumnoFila | null>(null)
  const [motivo, setMotivo] = useState(1)
  const [mensaje, setMensaje] = useState('')
  const [fechaCita, setFechaCita] = useState('')
  const [horaCita, setHoraCita] = useState('09:00')
  const [modo, setModo] = useState<'reporte' | 'informe' | 'cita'>('reporte')

  const asig = useMemo(() => {
    const [mid, letra] = asigKey.split('|')
    return asignaciones.find((a) => String(a.materia_id) === mid && a.grupo_letra === letra) ?? asignaciones[0]
  }, [asigKey, asignaciones])

  const tiposCaptura = useMemo(
    () => (me ? tiposCapturaDeRolNivel(me.role, fisica) : []),
    [me, fisica]
  )
  const tabs = me ? tabsDeRolNivel(me.role, config) : []

  const refreshMe = useCallback(async () => {
    try {
      const data = await api<{ me: Me; asignaciones: Asignacion[]; fisica?: boolean }>(
        `${config.apiBase}/sesion`
      )
      setMe(data.me)
      setAsignaciones(data.asignaciones ?? [])
      setFisica(Boolean(data.fisica))
      if (data.asignaciones?.[0]) {
        setAsigKey(`${data.asignaciones[0].materia_id}|${data.asignaciones[0].grupo_letra}`)
      }
      const nextTabs = tabsDeRolNivel(data.me.role, config)
      setTab((prev) => (nextTabs.some((t) => t.id === prev) ? prev : nextTabs[0]?.id ?? 'captura'))
      const tipos = tiposCapturaDeRolNivel(data.me.role, Boolean(data.fisica))
      if (tipos[0]) setTipo(tipos[0].valor)
    } catch {
      setMe(null)
    } finally {
      setBoot(false)
    }
  }, [config])

  useEffect(() => {
    void refreshMe()
  }, [refreshMe])

  async function cargarGrupo() {
    if (!asig) return
    setBusy(true)
    setMsg('')
    try {
      const data = await api<{ filas: AlumnoFila[] }>(
        `${config.apiBase}/captura?materiaId=${asig.materia_id}&grupo=${encodeURIComponent(asig.grupo_letra)}&tipo=${tipo}`
      )
      setFilas(data.filas)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setBusy(false)
    }
  }

  async function cargarVista(vista: string) {
    setBusy(true)
    setMsg('')
    try {
      const extra = vista === 'historial' ? `&q=${encodeURIComponent(q)}` : ''
      const data = await api<{ filas?: Record<string, unknown>[] }>(
        `${config.apiBase}/coordinacion?vista=${vista}${extra}`
      )
      setLista(data.filas ?? [])
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!me) return
    if (tab === 'captura' || tab === 'control_escolar') void cargarGrupo()
    if (tab === 'inbox') void cargarVista('pendientes')
    if (tab === 'informes') void cargarVista('informes')
    if (tab === 'citas') void cargarVista('citas')
    if (tab === 'suspensiones') void cargarVista('suspensiones')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, tab, asigKey, tipo])

  async function enviarCaptura() {
    if (!modal || !asig) return
    setBusy(true)
    try {
      await api(`${config.apiBase}/captura`, {
        method: 'POST',
        body: JSON.stringify({
          accion: modo,
          alumnoId: modal.alumno_id,
          materiaId: asig.materia_id,
          tipo,
          motivo,
          mensaje,
          fecha: fechaCita,
          hora: horaCita,
        }),
      })
      setMsg('Registro guardado')
      setModal(null)
      setMensaje('')
      await cargarGrupo()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  async function accionCoord(entidad: string, id: number, accion: string, fecha?: string) {
    setBusy(true)
    try {
      await api(`${config.apiBase}/coordinacion`, {
        method: 'POST',
        body: JSON.stringify({ entidad, id, accion, fecha }),
      })
      setMsg('Listo')
      if (tab === 'inbox') await cargarVista('pendientes')
      if (tab === 'informes') await cargarVista('informes')
      if (tab === 'citas') await cargarVista('citas')
      if (tab === 'suspensiones') await cargarVista('suspensiones')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    await api(`${config.apiBase}/auth/logout`, { method: 'POST' })
    setMe(null)
  }

  const esAdmin = me?.role === 'coordinacion' || me?.role === 'direccion'
  const esMaestro = me?.role === 'maestro'
  const unSoloGrupo = esMaestro && asignaciones.length === 1
  const sinAsignaciones = asignaciones.length === 0

  const stats = useMemo(() => {
    const conReporte = filas.filter((f) => f.aviso || f.r1 || f.r2 || f.r3).length
    return {
      alumnos: filas.length,
      seguimiento: conReporte,
      grupo: asig?.etiqueta_grupo ?? '—',
    }
  }, [filas, asig?.etiqueta_grupo])

  const heroText = useMemo(() => {
    if (!me) return ''
    if (me.role === 'psicologia') {
      return 'Conducta: reportar, aprobar pendientes, citatorios y avisos de atención.'
    }
    if (me.role === 'control_escolar') {
      return `${config.etiquetaOperaciones}: uniforme, vialidad y retardo.`
    }
    if (me.role === 'maestro') {
      return config.modoGradoGrupo
        ? 'Captura de reportes de tu grado y grupo — sin elegir materia.'
        : 'Captura de reportes y seguimiento de citas.'
    }
    return 'Panel de coordinación/dirección: listado, suspensión, citatorios, informes e impresión.'
  }, [me, config])

  if (boot) {
    return (
      <div className={`dashboard-container dashboard-home racn-page ${themeClass}`}>
        <div className="racn-bg" aria-hidden="true" />
        <p className="racn-boot">Cargando módulo…</p>
      </div>
    )
  }

  if (!me) {
    return (
      <div className={`dashboard-container dashboard-home racn-page racn-page--login ${themeClass}`}>
        <div className="racn-bg" aria-hidden="true" />
        <div className="dashboard-main racn-login-main">
          <div className="dashboard-heading racn-login-heading">
            <button
              type="button"
              className="servicios-back-btn"
              onClick={() => router.push('/reportes-conducta')}
            >
              <ArrowLeft size={16} aria-hidden />
              Niveles
            </button>
            <h1 className="dashboard-title">{config.titulo}</h1>
            <p className="dashboard-subtitle">{config.subtitulo}</p>
            <div className="facturacion-cfdi-theme-row">
              <ThemeToggle />
            </div>
          </div>
          <LoginPanel config={config} onOk={() => void refreshMe()} />
        </div>
      </div>
    )
  }

  return (
    <div className={`dashboard-container dashboard-home racn-page racn-page--${me.role} ${themeClass}`}>
      <div className="racn-bg" aria-hidden="true" />
      <div className="dashboard-main racn-app-main">
        <header className="racn-header">
          <button type="button" className="servicios-back-btn" onClick={() => router.push('/reportes-conducta')}>
            <ArrowLeft size={16} aria-hidden />
            Niveles
          </button>
          <div className="racn-header-meta">
            <strong>{me.nombre}</strong>
            <span className="racn-badge">{etiquetaRolNivel(me.role, config)}</span>
            <span>{me.etiquetaCiclo}</span>
          </div>
          <ThemeToggle />
          <button type="button" className="racn-btn ghost" onClick={() => void logout()}>
            <LogOut size={16} aria-hidden />
            Salir
          </button>
        </header>

        <div className="racn-hero">
          <div className="racn-hero-glow" aria-hidden="true" />
          <div className="racn-hero-icon" aria-hidden="true">
            {config.slug === 'maternal-kinder' ? <Sparkles size={28} /> : <Users size={28} />}
          </div>
          <div className="racn-hero-copy">
            <p className="racn-hero-kicker">{config.kicker}</p>
            <h1>{config.subtitulo}</h1>
            <p>{heroText}</p>
          </div>
        </div>

        {(tab === 'captura' || tab === 'control_escolar') && !sinAsignaciones ? (
          <div className="racn-stats" aria-label="Resumen del grupo">
            <article className="racn-stat">
              <UsersRound size={18} aria-hidden />
              <div>
                <strong>{stats.alumnos}</strong>
                <span>Alumnos en lista</span>
              </div>
            </article>
            <article className="racn-stat">
              <Sparkles size={18} aria-hidden />
              <div>
                <strong>{stats.seguimiento}</strong>
                <span>Con aviso o reporte</span>
              </div>
            </article>
            <article className="racn-stat racn-stat--wide">
              <div>
                <strong>{stats.grupo}</strong>
                <span>Grupo activo</span>
              </div>
            </article>
          </div>
        ) : null}

        {unSoloGrupo && asig ? (
          <div className="racn-grupo-badge">
            <span>Tu grupo</span>
            <strong>{asig.etiqueta_grupo}</strong>
          </div>
        ) : null}

        <nav className="racn-tabs" aria-label="Secciones">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {msg ? <p className="racn-msg">{msg}</p> : null}

        {(tab === 'captura' || tab === 'control_escolar') && (
          <section className="racn-panel racn-panel--captura">
            <div className="racn-toolbar">
              <div className="racn-filters">
                {!unSoloGrupo ? (
                  <label>
                    Grado / grupo
                    <select
                      value={asigKey}
                      onChange={(e) => setAsigKey(e.target.value)}
                      disabled={sinAsignaciones}
                    >
                      {sinAsignaciones ? (
                        <option value="">Sin grupos disponibles</option>
                      ) : (
                        asignaciones.map((a) => (
                          <option
                            key={`${a.materia_id}|${a.grupo_letra}|${a.grupo_id}`}
                            value={`${a.materia_id}|${a.grupo_letra}`}
                          >
                            {a.etiqueta_grupo}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                ) : null}
                <label>
                  Tipo
                  <select value={tipo} onChange={(e) => setTipo(Number(e.target.value))}>
                    {tiposCaptura.map((t) => (
                      <option key={t.valor} value={t.valor}>
                        {t.etiqueta}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="racn-btn racn-btn--refresh"
                  onClick={() => void cargarGrupo()}
                  disabled={busy || sinAsignaciones}
                >
                  <RefreshCw size={16} aria-hidden className={busy ? 'racn-spin' : ''} />
                  Actualizar
                </button>
              </div>
            </div>
            {sinAsignaciones ? (
              <div className="racn-empty">
                <p>No hay grados configurados todavía.</p>
                <small>Asigna maestros en Servicios → Catálogo de maestros o verifica alumnos activos del nivel.</small>
              </div>
            ) : (
              <div className="racn-table-wrap">
                <table className="racn-table">
                  <thead>
                    <tr>
                      <th>Alumno</th>
                      <th>Aviso</th>
                      <th>I</th>
                      <th>II</th>
                      <th>III</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="racn-empty-row">
                          No hay alumnos en este grado y grupo para el ciclo actual.
                        </td>
                      </tr>
                    ) : (
                      filas.map((a) => (
                        <tr key={a.alumno_id}>
                          <td>
                            <div className="racn-alumno-cell">
                              <span className="racn-avatar" aria-hidden="true">
                                {iniciales(a.nombre)}
                              </span>
                              <span>
                                <span className="racn-alumno-nombre">{a.nombre}</span>
                                <small>
                                  {a.alumno_ref ?? '—'} · {a.grado}° {a.grupo}
                                </small>
                              </span>
                            </div>
                          </td>
                          <td>
                            <ChipFecha valor={a.aviso || '—'} />
                          </td>
                          <td>
                            <ChipFecha valor={a.r1 || '—'} />
                          </td>
                          <td>
                            <ChipFecha valor={a.r2 || '—'} />
                          </td>
                          <td>
                            <ChipFecha valor={a.r3 || '—'} />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="racn-btn primary"
                              onClick={() => {
                                setModal(a)
                                setModo('reporte')
                                setMotivo(opcionesMotivo(tipo)[0]?.valor ?? 1)
                              }}
                            >
                              Reportar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === 'inbox' || tab === 'citas' || tab === 'suspensiones' || tab === 'historial' || tab === 'informes' ? (
          <section className="racn-panel">
            {tab === 'historial' ? (
              <div className="racn-filters">
                <label>
                  Buscar alumno
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Apellido o control" />
                </label>
                <button type="button" className="racn-btn" onClick={() => void cargarVista('historial')}>
                  Buscar
                </button>
              </div>
            ) : null}
            <div className="racn-table-wrap">
              <table className="racn-table">
                <thead>
                  <tr>
                    <th>Alumno</th>
                    <th>Detalle</th>
                    <th>Fecha</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((row, i) => (
                    <tr key={String(row.reporte_id ?? row.cita_id ?? row.suspension_id ?? i)}>
                      <td>
                        {String(row.nombre ?? '')}
                        <small className="racn-mini">
                          {String(row.alumno_ref ?? '')} {String(row.grado ?? '')}° {String(row.grupo ?? '')}
                        </small>
                      </td>
                      <td>
                        {String(row.escalon ?? row.tipoEtiqueta ?? row.materia ?? '')}
                        <span className="racn-mini">{String(row.motivo ?? row.mensaje ?? '')}</span>
                      </td>
                      <td>{String(row.fecha ?? '—')}</td>
                      <td className="racn-actions">
                        {tab === 'inbox' && me.role === 'psicologia' ? (
                          <>
                            <button
                              type="button"
                              className="racn-btn primary"
                              onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'validar')}
                            >
                              Aprobar
                            </button>
                            <button
                              type="button"
                              className="racn-btn"
                              onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'denegar')}
                            >
                              Denegar
                            </button>
                          </>
                        ) : null}
                        {tab === 'inbox' && esAdmin ? (
                          <>
                            <button
                              type="button"
                              className="racn-btn"
                              onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'reenviar')}
                            >
                              Reenviar
                            </button>
                            <button
                              type="button"
                              className="racn-btn"
                              onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'confirmar')}
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              className="racn-btn"
                              onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'detener')}
                            >
                              Detener
                            </button>
                          </>
                        ) : null}
                        {tab === 'informes' && esAdmin ? (
                          <button
                            type="button"
                            className="racn-btn"
                            onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'reenviar')}
                          >
                            Reenviar
                          </button>
                        ) : null}
                        {tab === 'citas' && (esAdmin || me.role === 'psicologia') ? (
                          <>
                            <button
                              type="button"
                              className="racn-btn"
                              onClick={() => void accionCoord('cita', Number(row.cita_id), 'reenviar')}
                            >
                              Reenviar
                            </button>
                            <button
                              type="button"
                              className="racn-btn"
                              onClick={() => void accionCoord('cita', Number(row.cita_id), 'confirmar')}
                            >
                              Enterado
                            </button>
                          </>
                        ) : null}
                        {tab === 'suspensiones' && esAdmin ? (
                          <button
                            type="button"
                            className="racn-btn primary"
                            onClick={() => {
                              const fecha = window.prompt('Fecha de suspensión (AAAA-MM-DD)')
                              if (fecha) void accionCoord('suspension', Number(row.suspension_id), 'aplicar', fecha)
                            }}
                          >
                            Aplicar fecha
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {modal ? (
          <div className="racn-modal" role="dialog" aria-modal="true">
            <div className="racn-modal-card">
              <h3>{modal.nombre}</h3>
              <div className="racn-filters">
                <label>
                  Acción
                  <select value={modo} onChange={(e) => setModo(e.target.value as typeof modo)}>
                    <option value="reporte">Reporte / aviso</option>
                    {me.role !== 'control_escolar' ? <option value="informe">Informe</option> : null}
                    <option value="cita">Cita</option>
                  </select>
                </label>
                {modo === 'reporte' ? (
                  <label>
                    Motivo
                    <select value={motivo} onChange={(e) => setMotivo(Number(e.target.value))}>
                      {opcionesMotivo(tipo).map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.etiqueta}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {modo === 'cita' ? (
                  <>
                    <label>
                      Fecha
                      <input type="date" value={fechaCita} onChange={(e) => setFechaCita(e.target.value)} />
                    </label>
                    <label>
                      Hora
                      <input type="time" value={horaCita} onChange={(e) => setHoraCita(e.target.value)} />
                    </label>
                  </>
                ) : null}
              </div>
              <label className="racn-msg">
                Observaciones
                <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={4} required />
              </label>
              <div className="racn-actions">
                <button type="button" className="racn-btn ghost" onClick={() => setModal(null)}>
                  Cancelar
                </button>
                <button type="button" className="racn-btn primary" disabled={busy} onClick={() => void enviarCaptura()}>
                  <Send size={16} aria-hidden />
                  Guardar y avisar
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

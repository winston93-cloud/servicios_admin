'use client'

import ThemeToggle from '@/components/ThemeToggle'
import type { RacNivelConfig } from '@/lib/rac/racNivelConfig'
import type { RacRolNivel } from '@/lib/rac/racNivelConfig'
import {
  esPanelAdminNivel,
  etiquetaRolNivel,
  puedePdfNivel,
  tabsDeRolNivel,
  tiposCapturaDeRolNivel,
  tiposCitaDeRolNivel,
  type RacTabNivel,
} from '@/lib/rac/racPermisosNivel'
import { opcionesMotivo } from '@/lib/racUi'
import {
  ArrowLeft,
  Download,
  FolderOpen,
  LogOut,
  Mail,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Users,
  UsersRound,
} from 'lucide-react'
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
  materia_nivel?: number
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

type AlumnoBusqueda = {
  alumno_id: number
  alumno_ref: string | number | null
  alumno_app?: string | null
  alumno_apm?: string | null
  alumno_nombre?: string | null
}

type CitaFila = {
  cita_id: number
  nombre: string
  mensaje: string
  fecha: string
  status: number
  tipoEtiqueta: string
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

function ChipSiNo({ valor }: { valor: boolean }) {
  return <span className={valor ? 'racn-flag racn-flag--si' : 'racn-flag racn-flag--no'}>{valor ? 'Sí' : 'No'}</span>
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
  const [tipoCita, setTipoCita] = useState(2)
  const [citaValidar, setCitaValidar] = useState<CitaFila | null>(null)
  const [detalleVista, setDetalleVista] = useState<Record<string, unknown> | null>(null)
  const [historialKardex, setHistorialKardex] = useState<{
    alumno: { alumno_id: number; alumno_ref: string | number | null; nombre: string; grado: number; grupo: string }
    reportes: Record<string, unknown>[]
  } | null>(null)
  const [historialAlumnos, setHistorialAlumnos] = useState<AlumnoBusqueda[]>([])
  const [historialAlumnoId, setHistorialAlumnoId] = useState(0)
  const [historialTipo, setHistorialTipo] = useState(1)
  const [historialMateriaId, setHistorialMateriaId] = useState(0)
  const [seleccionados, setSeleccionados] = useState<number[]>([])
  const puedeVerDetalleLista =
    tab === 'inbox' || tab === 'informes' || tab === 'citas' || tab === 'historial' || tab === 'suspensiones'

  const asig = useMemo(() => {
    const [mid, letra] = asigKey.split('|')
    return asignaciones.find((a) => String(a.materia_id) === mid && a.grupo_letra === letra) ?? asignaciones[0]
  }, [asigKey, asignaciones])

  const tiposCaptura = useMemo(
    () => (me ? tiposCapturaDeRolNivel(me.role, fisica) : []),
    [me, fisica]
  )
  const tabs = me ? tabsDeRolNivel(me.role, config) : []
  const tiposCita = me ? tiposCitaDeRolNivel(me.role) : []

  const refreshMe = useCallback(async () => {
    try {
      const data = await api<{ me: Me; asignaciones: Asignacion[]; fisica?: boolean }>(
        `${config.apiBase}/sesion`
      )
      setMe(data.me)
      setAsignaciones(data.asignaciones ?? [])
      setFisica(Boolean(data.fisica))
      const first = data.asignaciones?.[0]
      if (first) {
        setAsigKey(`${first.materia_id}|${first.grupo_letra}`)
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
        asig.materia_id
          ? `${config.apiBase}/captura?materiaId=${asig.materia_id}&grupo=${encodeURIComponent(asig.grupo_letra)}&tipo=${tipo}`
          : `${config.apiBase}/captura?nivelEscolar=${asig.materia_nivel ?? config.nivelesEscolares[0]}&grado=${asig.materia_grado}&grupo=${encodeURIComponent(asig.grupo_letra)}&tipo=${tipo}`
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
      const data = await api<{ filas?: Record<string, unknown>[]; alumnos?: AlumnoBusqueda[] }>(
        `${config.apiBase}/coordinacion?vista=${vista}${extra}`
      )
      setLista(data.filas ?? [])
      if (vista === 'historial') {
        const alumnos = data.alumnos ?? []
        setHistorialAlumnos(alumnos)
        if (alumnos[0]) setHistorialAlumnoId(Number(alumnos[0].alumno_id))
      }
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

  async function abrirHistorialAlumno(alumnoId: number) {
    setBusy(true)
    setMsg('')
    try {
      const data = await api<{
        alumno: {
          alumno_id: number
          alumno_ref: string | number | null
          nombre: string
          grado: number
          grupo: string
        }
        reportes: Record<string, unknown>[]
      }>(`${config.apiBase}/captura?historialAlumnoId=${alumnoId}`)
      setHistorialKardex(data)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo cargar el historial')
    } finally {
      setBusy(false)
    }
  }

  async function enviarCaptura() {
    if (!modal || !asig) return
    setBusy(true)
    try {
      const data = await api<{
        pendienteValidacion?: boolean
        envio?: { ok?: boolean; error?: string }
      }>(`${config.apiBase}/captura`, {
        method: 'POST',
        body: JSON.stringify({
          accion: modo,
          alumnoId: modal.alumno_id,
          materiaId: asig.materia_id,
          tipo: modo === 'cita' && me?.role === 'psicologia' ? tipoCita : tipo,
          motivo,
          mensaje,
          fecha: fechaCita,
          hora: horaCita,
        }),
      })
      if (data.pendienteValidacion) {
        setMsg(
          'Guardado. La conducta queda pendiente de Psicología; el correo a papás se envía al validarla.'
        )
      } else if (data.envio && data.envio.ok === false) {
        setMsg(`Guardado, pero el correo no salió: ${data.envio.error || 'error de envío'}.`)
      } else {
        setMsg('Registro guardado y correo enviado.')
      }
      setModal(null)
      setMensaje('')
      await cargarGrupo()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  async function accionCoord(
    entidad: string,
    id: number,
    accion: string,
    extra?: { fecha?: string; hora?: string; mensaje?: string }
  ) {
    setBusy(true)
    try {
      await api(`${config.apiBase}/coordinacion`, {
        method: 'POST',
        body: JSON.stringify({ entidad, id, accion, ...extra }),
      })
      setMsg('Listo')
      setCitaValidar(null)
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

  function descargarPdf(url: string, nombre: string) {
    void fetch(url, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) {
          const data = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(data.error || 'No se pudo generar el PDF')
        }
        return r.blob()
      })
      .then((blob) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = nombre
        a.click()
        URL.revokeObjectURL(a.href)
      })
      .catch((e) => setMsg(e instanceof Error ? e.message : 'Error al descargar PDF'))
  }

  const esAdmin = Boolean(me && esPanelAdminNivel(me.role))
  const esMaestro = me?.role === 'maestro'
  const unSoloGrupo = esMaestro && asignaciones.length === 1
  const sinAsignaciones = asignaciones.length === 0
  const puedeSeleccionarMasivo = Boolean(esAdmin && (tab === 'inbox' || tab === 'informes'))
  const capturaConInformeYCita = esAdmin || me?.role === 'psicologia'
  const capturaConInforme = capturaConInformeYCita || me?.role === 'maestro'
  const puedePdf = Boolean(me && puedePdfNivel(me.role))
  const listaVisible =
    tab === 'historial' && historialAlumnoId
      ? lista.filter((r) => Number(r.alumno_id) === historialAlumnoId)
      : lista
  const idsListaReportes = useMemo(
    () =>
      puedeSeleccionarMasivo
        ? lista.map((r) => Number(r.reporte_id)).filter((id) => Number.isFinite(id) && id > 0)
        : [],
    [lista, puedeSeleccionarMasivo]
  )
  const todosSeleccionados =
    idsListaReportes.length > 0 && idsListaReportes.every((id) => seleccionados.includes(id))

  useEffect(() => {
    setSeleccionados([])
  }, [tab, lista])

  function toggleSeleccionado(id: number) {
    setSeleccionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleTodos() {
    setSeleccionados(todosSeleccionados ? [] : idsListaReportes)
  }

  async function reenviarSeleccionados() {
    if (!seleccionados.length) {
      setMsg('Selecciona al menos un reporte para reenviar.')
      return
    }
    setBusy(true)
    let ok = 0
    let fail = 0
    for (const id of seleccionados) {
      try {
        await api(`${config.apiBase}/coordinacion`, {
          method: 'POST',
          body: JSON.stringify({ entidad: 'reporte', id, accion: 'reenviar' }),
        })
        ok += 1
      } catch {
        fail += 1
      }
    }
    setMsg(fail ? `Reenviados: ${ok} · No enviados: ${fail}` : `Reenviados correctamente: ${ok}`)
    setSeleccionados([])
    try {
      if (tab === 'inbox') await cargarVista('pendientes')
      if (tab === 'informes') await cargarVista('informes')
    } finally {
      setBusy(false)
    }
  }

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
      return 'Conducta: reportar, aprobar pendientes, citatorios, avisos de atención e historial.'
    }
    if (me.role === 'maestro') {
      return config.modoGradoGrupo
        ? 'Captura de reportes de tu grado y grupo — sin elegir materia.'
        : 'Captura de reportes y seguimiento de citas.'
    }
    return `Panel de ${config.etiquetaOperaciones.toLowerCase()}/dirección/coordinación: listado, suspensión, citatorios, informes, captura e impresión.`
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
                      <th
                        title={
                          capturaConInformeYCita
                            ? 'Reporte: afecta el escalón. Informe: sin afectar el No de reportes. Citar: citatorio.'
                            : 'Reporte: afecta el escalón. Informe: sin afectar el No de reportes.'
                        }
                      >
                        {capturaConInformeYCita ? 'Reporte | Informe | Cita' : 'Reporte | Informe'}
                      </th>
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
                          <td className="racn-actions racn-actions--captura">
                            <button
                              type="button"
                              className="racn-btn ghost racn-btn-icon"
                              title="Historial de reportes (materia, motivo y observaciones)"
                              aria-label={`Historial de ${a.nombre}`}
                              onClick={() => void abrirHistorialAlumno(a.alumno_id)}
                            >
                              <FolderOpen size={16} aria-hidden />
                              <span className="racn-btn-label">Historial</span>
                            </button>
                            <button
                              type="button"
                              className="racn-btn primary"
                              title="Crear reporte / aviso (escalones)"
                              onClick={() => {
                                setModal(a)
                                setModo('reporte')
                                setMensaje('')
                                setMotivo(opcionesMotivo(tipo)[0]?.valor ?? 1)
                              }}
                            >
                              Reportar
                            </button>
                            {capturaConInforme ? (
                              <button
                                type="button"
                                className="racn-btn info"
                                title={
                                  me.role === 'psicologia'
                                    ? 'Aviso de atención (sin escalones)'
                                    : 'Informe de aprendizaje (sin afectar el No de reportes)'
                                }
                                onClick={() => {
                                  setModal(a)
                                  setModo('informe')
                                  setMensaje('')
                                }}
                              >
                                {me.role === 'psicologia' ? 'Aviso' : 'Informe'}
                              </button>
                            ) : null}
                            {capturaConInformeYCita ? (
                              <button
                                type="button"
                                className="racn-btn success"
                                title="Generar citatorio"
                                onClick={() => {
                                  setModal(a)
                                  setModo('cita')
                                  setMensaje('')
                                  setFechaCita('')
                                  setHoraCita('09:00')
                                  if (me.role === 'psicologia') setTipoCita(tiposCita[0]?.valor ?? 2)
                                }}
                              >
                                Citar
                              </button>
                            ) : null}
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
            {tab === 'inbox' && esAdmin ? (
              <div className="racn-filters">
                {puedePdf ? (
                  <button
                    type="button"
                    className="racn-btn download"
                    onClick={() =>
                      descargarPdf(`${config.apiBase}/impresion?modo=pendientes`, `rac-${config.slug}-pendientes.pdf`)
                    }
                  >
                    <Download size={16} aria-hidden />
                    PDF reportes sin confirmar
                  </button>
                ) : null}
                <button
                  type="button"
                  className="racn-btn info"
                  disabled={busy || seleccionados.length === 0}
                  onClick={() => void reenviarSeleccionados()}
                >
                  <Mail size={16} aria-hidden />
                  Reenviar seleccionados{seleccionados.length ? ` (${seleccionados.length})` : ''}
                </button>
              </div>
            ) : null}
            {tab === 'informes' && esAdmin ? (
              <div className="racn-filters">
                <button
                  type="button"
                  className="racn-btn info"
                  disabled={busy || seleccionados.length === 0}
                  onClick={() => void reenviarSeleccionados()}
                >
                  <Mail size={16} aria-hidden />
                  Reenviar seleccionados{seleccionados.length ? ` (${seleccionados.length})` : ''}
                </button>
              </div>
            ) : null}
            {tab === 'historial' ? (
              <div className="racn-filters">
                <label>
                  Buscar alumno
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Apellido o control" />
                </label>
                <button type="button" className="racn-btn" onClick={() => void cargarVista('historial')}>
                  Buscar
                </button>
                {historialAlumnos.length ? (
                  <label>
                    Alumno
                    <select
                      value={historialAlumnoId}
                      onChange={(e) => setHistorialAlumnoId(Number(e.target.value))}
                    >
                      {historialAlumnos.map((a) => (
                        <option key={a.alumno_id} value={a.alumno_id}>
                          {[a.alumno_app, a.alumno_apm, a.alumno_nombre].filter(Boolean).join(' ')} · {a.alumno_ref}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label>
                  Tipo de reporte
                  <select value={historialTipo} onChange={(e) => setHistorialTipo(Number(e.target.value))}>
                    <option value={1}>Académico</option>
                    <option value={2}>Conducta</option>
                    <option value={3}>Uniforme</option>
                    <option value={4}>Vialidad</option>
                    <option value={6}>Retardo</option>
                  </select>
                </label>
                {historialTipo === 1 ? (
                  <label>
                    Materia / grupo
                    <select
                      value={historialMateriaId}
                      onChange={(e) => setHistorialMateriaId(Number(e.target.value))}
                    >
                      <option value={0}>Todas</option>
                      {asignaciones.map((a) => (
                        <option key={`${a.materia_id}-${a.grupo_letra}`} value={a.materia_id}>
                          {a.etiqueta_grupo}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {historialAlumnoId && puedePdf ? (
                  <button
                    type="button"
                    className="racn-btn download"
                    onClick={() =>
                      descargarPdf(
                        `${config.apiBase}/impresion?modo=historial&alumnoId=${historialAlumnoId}&reporteTipo=${historialTipo}${
                          historialMateriaId ? `&materiaId=${historialMateriaId}` : ''
                        }`,
                        `rac-${config.slug}-historial-${historialAlumnoId}.pdf`
                      )
                    }
                  >
                    <Download size={16} aria-hidden />
                    Imprimir PDF
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="racn-table-wrap">
              <table className="racn-table">
                <thead>
                  <tr>
                    {puedeSeleccionarMasivo ? (
                      <th className="racn-check-col">
                        <label className="racn-check">
                          <input
                            type="checkbox"
                            checked={todosSeleccionados}
                            onChange={toggleTodos}
                            aria-label="Seleccionar todos"
                          />
                        </label>
                      </th>
                    ) : null}
                    <th>Alumno</th>
                    <th>Detalle</th>
                    <th>Fecha</th>
                    {tab === 'inbox' || tab === 'informes' || tab === 'citas' || tab === 'historial' ? (
                      <>
                        <th>Enviado</th>
                        <th>Confirmado</th>
                      </>
                    ) : null}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {listaVisible.map((row, i) => {
                    const reporteId = Number(row.reporte_id)
                    return (
                      <tr key={String(row.reporte_id ?? row.cita_id ?? row.suspension_id ?? i)}>
                        {puedeSeleccionarMasivo ? (
                          <td className="racn-check-col">
                            <label className="racn-check">
                              <input
                                type="checkbox"
                                checked={seleccionados.includes(reporteId)}
                                onChange={() => toggleSeleccionado(reporteId)}
                                aria-label={`Seleccionar ${String(row.nombre ?? 'reporte')}`}
                              />
                            </label>
                          </td>
                        ) : null}
                        <td>
                          {String(row.nombre ?? '')}
                          <small className="racn-mini">
                            {String(row.alumno_ref ?? '')} {String(row.grado ?? '')}° {String(row.grupo ?? '')}
                          </small>
                        </td>
                        <td>
                          {String(row.escalon ?? row.tipoEtiqueta ?? row.materia ?? '')}
                          {row.materia ? (
                            <span className="racn-mini">Materia: {String(row.materia)}</span>
                          ) : null}
                          <span className="racn-mini">{String(row.motivo ?? row.mensaje ?? '')}</span>
                        </td>
                        <td>{String(row.fecha ?? '—')}</td>
                        {tab === 'inbox' || tab === 'informes' || tab === 'citas' || tab === 'historial' ? (
                          <>
                            <td>
                              <ChipSiNo valor={Boolean(row.enviado ?? row.enviada)} />
                            </td>
                            <td>
                              <ChipSiNo valor={Boolean(row.confirmado ?? row.confirmada)} />
                            </td>
                          </>
                        ) : null}
                        <td className="racn-actions">
                          {puedeVerDetalleLista ? (
                            <button
                              type="button"
                              className="racn-btn ghost racn-btn-icon"
                              title="Ver detalle del reporte / citatorio"
                              aria-label="Ver detalle"
                              onClick={() => setDetalleVista(row)}
                            >
                              <Search size={16} aria-hidden />
                              <span className="racn-btn-label">Detalle</span>
                            </button>
                          ) : null}
                          {tab === 'inbox' && me.role === 'psicologia' ? (
                            <>
                              <button
                                type="button"
                                className="racn-btn success"
                                onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'validar')}
                              >
                                Aprobar
                              </button>
                              <button
                                type="button"
                                className="racn-btn danger"
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
                                className="racn-btn info"
                                onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'reenviar')}
                              >
                                Reenviar
                              </button>
                              <button
                                type="button"
                                className="racn-btn success"
                                onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'confirmar')}
                              >
                                Confirmar
                              </button>
                              <button
                                type="button"
                                className="racn-btn danger"
                                onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'detener')}
                              >
                                Detener
                              </button>
                            </>
                          ) : null}
                          {tab === 'informes' && esAdmin ? (
                            <button
                              type="button"
                              className="racn-btn info"
                              onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'reenviar')}
                            >
                              Reenviar
                            </button>
                          ) : null}
                          {tab === 'citas' && (esAdmin || me.role === 'psicologia') ? (
                            <>
                              {esAdmin && Number(row.status) === 2 ? (
                                <button
                                  type="button"
                                  className="racn-btn primary"
                                  onClick={() =>
                                    setCitaValidar({
                                      cita_id: Number(row.cita_id),
                                      nombre: String(row.nombre ?? ''),
                                      mensaje: String(row.mensaje ?? ''),
                                      fecha: String(row.fecha ?? ''),
                                      status: Number(row.status ?? 0),
                                      tipoEtiqueta: String(row.tipoEtiqueta ?? ''),
                                    })
                                  }
                                >
                                  Validar cita
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="racn-btn info"
                                onClick={() => void accionCoord('cita', Number(row.cita_id), 'reenviar')}
                              >
                                Reenviar
                              </button>
                              <button
                                type="button"
                                className="racn-btn success"
                                onClick={() => void accionCoord('cita', Number(row.cita_id), 'confirmar')}
                              >
                                Enterado
                              </button>
                              {esAdmin ? (
                                <button
                                  type="button"
                                  className="racn-btn danger"
                                  onClick={() => void accionCoord('cita', Number(row.cita_id), 'detener')}
                                >
                                  Anular
                                </button>
                              ) : null}
                            </>
                          ) : null}
                          {tab === 'suspensiones' && esAdmin ? (
                            <button
                              type="button"
                              className="racn-btn primary"
                              onClick={() => {
                                const fecha = window.prompt('Fecha de suspensión (AAAA-MM-DD)')
                                if (fecha) void accionCoord('suspension', Number(row.suspension_id), 'aplicar', { fecha })
                              }}
                            >
                              Aplicar fecha
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {historialKardex ? (
          <div className="racn-modal" role="dialog" aria-modal="true" aria-labelledby="racn-historial-title">
            <div className="racn-modal-card racn-detalle-card">
              <h3 id="racn-historial-title">Historial de reportes</h3>
              <p className="racn-mini">
                {historialKardex.alumno.nombre} · {String(historialKardex.alumno.alumno_ref ?? '—')} ·{' '}
                {historialKardex.alumno.grado}° {historialKardex.alumno.grupo}
              </p>
              {historialKardex.reportes.length === 0 ? (
                <p>Sin historial en el ciclo actual.</p>
              ) : (
                <div className="racn-historial-lista">
                  {historialKardex.reportes.map((r) => (
                    <section key={String(r.reporte_id)} className="racn-historial-item">
                      <strong>
                        {String(r.escalon ?? r.tipoEtiqueta ?? 'Reporte')}
                        {r.vuelta != null ? ` · Vuelta ${String(r.vuelta)}` : ''}
                      </strong>
                      {r.materia ? <div>Materia: {String(r.materia)}</div> : null}
                      {r.motivo ? <div>Motivo: {String(r.motivo)}</div> : null}
                      <div className="racn-detalle-obs">Observaciones: {String(r.mensaje || '—')}</div>
                      <div className="racn-mini">
                        Fecha: {String(r.fecha ?? '—')} · Enviado: {r.enviado ? 'Sí' : 'No'} · Confirmado:{' '}
                        {r.confirmado ? 'Sí' : 'No'}
                      </div>
                    </section>
                  ))}
                </div>
              )}
              <div className="racn-actions">
                <button type="button" className="racn-btn primary" onClick={() => setHistorialKardex(null)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {detalleVista ? (
          <div className="racn-modal" role="dialog" aria-modal="true" aria-labelledby="racn-detalle-title">
            <div className="racn-modal-card racn-detalle-card">
              <h3 id="racn-detalle-title">Detalle</h3>
              <dl className="racn-detalle-dl">
                {detalleVista.reporte_id != null ? (
                  <div>
                    <dt>ID</dt>
                    <dd>{String(detalleVista.reporte_id)}</dd>
                  </div>
                ) : null}
                {detalleVista.cita_id != null ? (
                  <div>
                    <dt>ID cita</dt>
                    <dd>{String(detalleVista.cita_id)}</dd>
                  </div>
                ) : null}
                {detalleVista.suspension_id != null ? (
                  <div>
                    <dt>ID suspensión</dt>
                    <dd>{String(detalleVista.suspension_id)}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>No. Control</dt>
                  <dd>{String(detalleVista.alumno_ref ?? '—')}</dd>
                </div>
                <div>
                  <dt>Alumno</dt>
                  <dd>{String(detalleVista.nombre ?? '—')}</dd>
                </div>
                <div>
                  <dt>Grado y grupo</dt>
                  <dd>
                    {detalleVista.grado != null ? `${String(detalleVista.grado)}°` : '—'}{' '}
                    {String(detalleVista.grupo ?? '')}
                  </dd>
                </div>
                {detalleVista.materia || detalleVista.escalon || detalleVista.tipoEtiqueta ? (
                  <div>
                    <dt>Situación / materia</dt>
                    <dd>
                      {String(detalleVista.escalon ?? detalleVista.tipoEtiqueta ?? '')}
                      {detalleVista.materia ? ` · ${String(detalleVista.materia)}` : ''}
                    </dd>
                  </div>
                ) : null}
                {detalleVista.motivo ? (
                  <div>
                    <dt>Motivo</dt>
                    <dd>{String(detalleVista.motivo)}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Observaciones</dt>
                  <dd className="racn-detalle-obs">{String(detalleVista.mensaje ?? '—')}</dd>
                </div>
                <div>
                  <dt>Fecha</dt>
                  <dd>{String(detalleVista.fecha ?? '—')}</dd>
                </div>
                {detalleVista.vuelta != null && detalleVista.vuelta !== '' ? (
                  <div>
                    <dt>No. vuelta</dt>
                    <dd>{String(detalleVista.vuelta)}</dd>
                  </div>
                ) : null}
                {detalleVista.enviado != null || detalleVista.enviada != null ? (
                  <div>
                    <dt>Enviado</dt>
                    <dd>{detalleVista.enviado || detalleVista.enviada ? 'Sí' : 'No'}</dd>
                  </div>
                ) : null}
                {detalleVista.confirmado != null || detalleVista.confirmada != null ? (
                  <div>
                    <dt>Confirmado</dt>
                    <dd>{detalleVista.confirmado || detalleVista.confirmada ? 'Sí' : 'No'}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="racn-actions">
                <button type="button" className="racn-btn primary" onClick={() => setDetalleVista(null)}>
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {modal ? (
          <div className="racn-modal" role="dialog" aria-modal="true">
            <div className="racn-modal-card">
              <h3>
                {modo === 'informe'
                  ? me.role === 'psicologia'
                    ? `Aviso de atención — ${modal.nombre}`
                    : `Informe sobre actitud de aprendizaje — ${modal.nombre}`
                  : modo === 'cita'
                    ? `Citatorio — ${modal.nombre}`
                    : `Reporte / aviso — ${modal.nombre}`}
              </h3>
              {modo === 'informe' ? (
                <p className="racn-mini">
                  {me.role === 'psicologia'
                    ? 'No afecta el escalón de reportes del alumno.'
                    : 'Envía un informe sin afectar el número de reportes del alumno.'}
                </p>
              ) : null}
              <div className="racn-filters">
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
                    {me.role === 'psicologia' ? (
                      <label>
                        Tipo de citatorio
                        <select value={tipoCita} onChange={(e) => setTipoCita(Number(e.target.value))}>
                          {tiposCita.map((t) => (
                            <option key={t.valor} value={t.valor}>
                              {t.etiqueta}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label>
                      Fecha
                      <input type="date" value={fechaCita} onChange={(e) => setFechaCita(e.target.value)} required />
                    </label>
                    <label>
                      Hora
                      <input type="time" value={horaCita} onChange={(e) => setHoraCita(e.target.value)} required />
                    </label>
                  </>
                ) : null}
              </div>
              <label className="racn-msg">
                {modo === 'informe' ? 'Mensaje del informe' : 'Observaciones'}
                <textarea
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  rows={4}
                  required
                  placeholder={modo === 'informe' ? 'Redacte aquí su informe' : undefined}
                />
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

        {citaValidar ? (
          <div className="racn-modal" role="dialog" aria-modal="true">
            <div className="racn-modal-card">
              <h3>Validar citatorio — {citaValidar.nombre}</h3>
              <p className="racn-mini">{citaValidar.tipoEtiqueta}</p>
              <div className="racn-filters">
                <label>
                  Fecha
                  <input type="date" value={fechaCita} onChange={(e) => setFechaCita(e.target.value)} required />
                </label>
                <label>
                  Hora
                  <input type="time" value={horaCita} onChange={(e) => setHoraCita(e.target.value)} required />
                </label>
              </div>
              <label className="racn-msg">
                Mensaje
                <textarea
                  value={mensaje || citaValidar.mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  rows={4}
                />
              </label>
              <div className="racn-actions">
                <button type="button" className="racn-btn ghost" onClick={() => setCitaValidar(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="racn-btn primary"
                  disabled={busy || !fechaCita}
                  onClick={() =>
                    void accionCoord('cita', citaValidar.cita_id, 'validar', {
                      fecha: fechaCita,
                      hora: horaCita,
                      mensaje: mensaje || citaValidar.mensaje,
                    })
                  }
                >
                  <Send size={16} aria-hidden />
                  Programar y enviar
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

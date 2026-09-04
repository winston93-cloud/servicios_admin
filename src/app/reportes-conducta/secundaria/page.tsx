'use client'

import ThemeToggle from '@/components/ThemeToggle'
import { etiquetaGradoStaffSecundaria } from '@/lib/racCatalogo'
import { opcionesMotivo } from '@/lib/racUi'
import { etiquetaRol, esPanelAdminRac, tabsDeRol, tiposCapturaDeRol, tiposCitaDeRol, type RacTab } from '@/lib/racPermisos'
import { ArrowLeft, Download, Eye, EyeOff, LogOut, Mail, Search, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import '../../dashboard/dashboard-module-card.css'
import '../../boletas-secundaria/boletas-secundaria.css'
import '../reportes-conducta.css'
import './rac-secundaria.css'

type Rol = 'maestro' | 'coordinacion' | 'psicologia' | 'prefectura' | 'direccion'

type Me = {
  role: Rol
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
  alumno_app: string | null
  alumno_apm: string | null
  alumno_nombre: string | null
}

type CitaFila = {
  cita_id: number
  nombre: string
  mensaje: string
  fecha: string
  status: number
  tipoEtiqueta: string
}

type Tab = RacTab

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

function ChipFecha({ valor }: { valor: string }) {
  const vacio = !valor || valor === '—' || valor === '-'
  return <span className={vacio ? 'rac-chip rac-chip--empty' : 'rac-chip rac-chip--set'}>{vacio ? '—' : valor}</span>
}

function ChipSiNo({ valor }: { valor: boolean }) {
  return <span className={valor ? 'rac-flag rac-flag--si' : 'rac-flag rac-flag--no'}>{valor ? 'Sí' : 'No'}</span>
}

function LoginPanel({ onOk }: { onOk: () => void }) {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api('/api/rac/auth/login', {
        method: 'POST',
        body: JSON.stringify({ usuario: usuario.trim(), password: password.trim() }),
      })
      onOk()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="rac-login-card" onSubmit={(ev) => void submit(ev)} autoComplete="off">
      <p className="rac-login-kicker">Acceso docente</p>
      <h2>Ingresar a Secundaria</h2>
      <p className="rac-login-lead">
        Acceso directo para maestros y staff de secundaria. Al entrar con tu
        cuenta de maestro verás solo tus materias y grupos (A, B, C) para
        capturar reportes académicos y de conducta.
      </p>
      <label>
        Usuario
        <input
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          name="rac-secundaria-usuario"
          placeholder="Ej. juan"
          required
        />
      </label>
      <label>
        Contraseña
        <span className="rac-login-pw-wrap">
          <input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            name="rac-secundaria-clave"
            required
          />
          <button
            type="button"
            className="rac-login-pw-toggle"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      </label>
      <p className="rac-login-hint">Si falla, revisa mayúsculas y caracteres especiales (copiar/pegar suele ser más seguro).</p>
      {error ? <p className="rac-login-error">{error}</p> : null}
      <button type="submit" className="rac-login-submit" disabled={loading}>
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}

export default function RacSecundariaPage() {
  const router = useRouter()
  const [boot, setBoot] = useState(true)
  const [me, setMe] = useState<Me | null>(null)
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([])
  const [fisica, setFisica] = useState(false)
  const [tab, setTab] = useState<Tab>('captura')
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
  const [historialAlumnos, setHistorialAlumnos] = useState<AlumnoBusqueda[]>([])
  const [historialAlumnoId, setHistorialAlumnoId] = useState(0)
  const [historialTipo, setHistorialTipo] = useState(1)
  const [historialMateriaId, setHistorialMateriaId] = useState(0)
  const [seleccionados, setSeleccionados] = useState<number[]>([])
  const puedeVerDetalleLista =
    tab === 'inbox' || tab === 'informes' || tab === 'citas' || tab === 'historial' || tab === 'suspensiones'

  const asig = useMemo(() => {
    if (!asignaciones.length) return undefined
    // Staff: clave "grado|letra". Maestro: "materiaId|letra".
    const parts = asigKey.split('|')
    if (me && me.role !== 'maestro') {
      const grado = Number(parts[0])
      const letra = parts[1] ?? ''
      return (
        asignaciones.find((a) => a.materia_grado === grado && a.grupo_letra === letra) ??
        asignaciones[0]
      )
    }
    const [mid, letra] = parts
    return asignaciones.find((a) => String(a.materia_id) === mid && a.grupo_letra === letra) ?? asignaciones[0]
  }, [asigKey, asignaciones, me])

  const esStaff = Boolean(me && me.role !== 'maestro')
  const gradosStaff = useMemo(
    () => [...new Set(asignaciones.map((a) => a.materia_grado).filter(Boolean))].sort((a, b) => a - b),
    [asignaciones]
  )
  const gruposStaff = useMemo(() => {
    if (!asig) return [] as string[]
    return [
      ...new Set(
        asignaciones.filter((a) => a.materia_grado === asig.materia_grado).map((a) => a.grupo_letra)
      ),
    ].sort()
  }, [asignaciones, asig])

  const tiposCaptura = useMemo(
    () => (me ? tiposCapturaDeRol(me.role, fisica) : []),
    [me, fisica]
  )
  const tabs = me ? tabsDeRol(me.role) : []
  const tiposCita = me ? tiposCitaDeRol(me.role) : []

  const refreshMe = useCallback(async () => {
    try {
      const data = await api<{ me: Me; asignaciones: Asignacion[]; fisica?: boolean }>('/api/rac/sesion')
      setMe(data.me)
      setAsignaciones(data.asignaciones ?? [])
      setFisica(Boolean(data.fisica))
      const first = data.asignaciones?.[0]
      if (first) {
        setAsigKey(
          data.me.role === 'maestro'
            ? `${first.materia_id}|${first.grupo_letra}`
            : `${first.materia_grado}|${first.grupo_letra}`
        )
      }
      const nextTabs = tabsDeRol(data.me.role)
      setTab((prev) => (nextTabs.some((t) => t.id === prev) ? prev : nextTabs[0]?.id ?? 'captura'))
      const tipos = tiposCapturaDeRol(data.me.role, Boolean(data.fisica))
      if (tipos[0]) setTipo(tipos[0].valor)
    } catch {
      setMe(null)
    } finally {
      setBoot(false)
    }
  }, [])

  useEffect(() => {
    void refreshMe()
  }, [refreshMe])

  async function cargarGrupo() {
    if (!asig) return
    setBusy(true)
    setMsg('')
    try {
      const qs =
        me && me.role !== 'maestro'
          ? `grado=${asig.materia_grado}&grupo=${encodeURIComponent(asig.grupo_letra)}&tipo=${tipo}`
          : `materiaId=${asig.materia_id}&grupo=${encodeURIComponent(asig.grupo_letra)}&tipo=${tipo}`
      const data = await api<{ filas: AlumnoFila[] }>(`/api/rac/captura?${qs}`)
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
        `/api/rac/coordinacion?vista=${vista}${extra}`
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
    if (tab === 'captura' || tab === 'prefectura') void cargarGrupo()
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
      const data = await api<{
        pendienteValidacion?: boolean
        envio?: { ok?: boolean; error?: string }
      }>('/api/rac/captura', {
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
        setMsg(
          `Guardado, pero el correo no salió: ${data.envio.error || 'error de envío'}.`
        )
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
      await api('/api/rac/coordinacion', {
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
    await api('/api/rac/auth/logout', { method: 'POST' })
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

  const esAdmin = Boolean(me && esPanelAdminRac(me.role))
  const tiposSelect = tiposCaptura
  const puedeSeleccionarMasivo = Boolean(esAdmin && (tab === 'inbox' || tab === 'informes'))
  /** Misma captura que legacy coord: Reportar + Informe + Citar (prefectura y dirección). */
  const capturaConInformeYCita = esAdmin || me?.role === 'psicologia'
  const capturaConInforme = capturaConInformeYCita || me?.role === 'maestro'
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
        await api('/api/rac/coordinacion', {
          method: 'POST',
          body: JSON.stringify({ entidad: 'reporte', id, accion: 'reenviar' }),
        })
        ok += 1
      } catch {
        fail += 1
      }
    }
    setMsg(
      fail
        ? `Reenviados: ${ok} · No enviados: ${fail}`
        : `Reenviados correctamente: ${ok}`
    )
    setSeleccionados([])
    try {
      if (tab === 'inbox') await cargarVista('pendientes')
      if (tab === 'informes') await cargarVista('informes')
    } finally {
      setBusy(false)
    }
  }

  if (boot) {
    return (
      <div className="dashboard-container dashboard-home rac-page">
        <div className="dashboard-home-bg" aria-hidden="true" />
        <p className="rac-boot">Cargando módulo…</p>
      </div>
    )
  }

  if (!me) {
    return (
      <div className="dashboard-container dashboard-home rac-page rac-page--login">
        <div className="dashboard-home-bg" aria-hidden="true" />
        <div className="dashboard-main rac-login-main">
          <div className="dashboard-heading rac-login-heading">
            <button
              type="button"
              className="servicios-back-btn"
              onClick={() => router.push('/reportes-conducta')}
            >
              <ArrowLeft size={16} aria-hidden />
              Niveles
            </button>
            <h1 className="dashboard-title">Secundaria</h1>
            <p className="dashboard-subtitle">Reportes académicos y de conducta</p>
            <div className="facturacion-cfdi-theme-row">
              <ThemeToggle />
            </div>
          </div>
          <LoginPanel onOk={() => void refreshMe()} />
        </div>
      </div>
    )
  }

  return (
    <div className={`dashboard-container dashboard-home rac-page rac-page--${me.role}`}>
      <div className="dashboard-home-bg" aria-hidden="true" />
      <div className="dashboard-main rac-app-main">
      <header className="boletas-header">
        <button type="button" className="servicios-back-btn" onClick={() => router.push('/reportes-conducta')}>
          <ArrowLeft size={16} aria-hidden />
          Niveles
        </button>
        <div className="boletas-header-meta">
          <strong>{me.nombre}</strong>
          <span className="boletas-badge">{etiquetaRol(me.role)}</span>
          <span>{me.etiquetaCiclo}</span>
        </div>
        <ThemeToggle />
        <button type="button" className="boletas-btn ghost" onClick={() => void logout()}>
          <LogOut size={16} aria-hidden />
          Salir
        </button>
      </header>

      <div className="boletas-heading rac-hero">
        <p className="rac-hero-kicker">Instituto Winston Churchill · Secundaria</p>
        <h1>Reportes académicos y de conducta</h1>
        <p>
          {me.role === 'psicologia'
            ? 'Módulo de conducta: elige grado (7mo/8vo/9no) y grupo, reporta, aprueba pendientes, citatorios y avisos de atención.'
            : me.role === 'maestro'
              ? 'Al entrar ves solo tus materias y grupos. Elige materia · grado · grupo (ej. 3° B) para capturar reportes de tus alumnos.'
              : 'Panel de coordinación/dirección/prefectura: listado, suspensión, citatorios, informes, captura e impresión.'}
        </p>
      </div>

      <nav className="boletas-tabs" aria-label="Secciones">
        {tabs.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {msg ? <p className="boletas-msg">{msg}</p> : null}

      {(tab === 'captura' || tab === 'prefectura') && (
        <section className="boletas-panel">
          <div className="boletas-filters">
            {esStaff ? (
              <>
                <label>
                  Grado
                  <select
                    value={asig?.materia_grado ?? ''}
                    onChange={(e) => {
                      const g = Number(e.target.value)
                      const letra = asig?.grupo_letra || 'A'
                      setAsigKey(`${g}|${letra}`)
                    }}
                  >
                    {gradosStaff.map((g) => (
                      <option key={g} value={g}>
                        {etiquetaGradoStaffSecundaria(g)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Grupo
                  <select
                    value={asig?.grupo_letra ?? ''}
                    onChange={(e) => {
                      const letra = e.target.value
                      const g = asig?.materia_grado ?? 1
                      setAsigKey(`${g}|${letra}`)
                    }}
                  >
                    {gruposStaff.map((letra) => (
                      <option key={letra} value={letra}>
                        {letra}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
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
            )}
            <label>
              Tipo
              <select value={tipo} onChange={(e) => setTipo(Number(e.target.value))}>
                {tiposSelect.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="boletas-btn" onClick={() => void cargarGrupo()} disabled={busy}>
              Actualizar
            </button>
          </div>
          <div className="boletas-table-wrap">
            <table className="boletas-table">
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
                {filas.map((a) => (
                  <tr key={a.alumno_id}>
                    <td>
                      <div className="boletas-alumno-cell">
                        <span>{a.nombre}</span>
                        <small>
                          {a.alumno_ref ?? '—'} · {a.grado}° {a.grupo}
                        </small>
                      </div>
                    </td>
                    <td><ChipFecha valor={a.aviso || '—'} /></td>
                    <td><ChipFecha valor={a.r1 || '—'} /></td>
                    <td><ChipFecha valor={a.r2 || '—'} /></td>
                    <td><ChipFecha valor={a.r3 || '—'} /></td>
                    <td className="rac-actions rac-actions--captura">
                      <button
                        type="button"
                        className="boletas-btn primary"
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
                          className="boletas-btn info"
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
                          className="boletas-btn success"
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
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'inbox' || tab === 'citas' || tab === 'suspensiones' || tab === 'historial' || tab === 'informes' ? (
        <section className="boletas-panel">
          {tab === 'inbox' && esAdmin ? (
            <div className="boletas-filters">
              <button
                type="button"
                className="boletas-btn download"
                onClick={() => descargarPdf('/api/rac/impresion?modo=pendientes', 'rac-pendientes.pdf')}
              >
                <Download size={16} aria-hidden />
                PDF reportes sin confirmar
              </button>
              <button
                type="button"
                className="boletas-btn info"
                disabled={busy || seleccionados.length === 0}
                onClick={() => void reenviarSeleccionados()}
              >
                <Mail size={16} aria-hidden />
                Reenviar seleccionados{seleccionados.length ? ` (${seleccionados.length})` : ''}
              </button>
            </div>
          ) : null}
          {tab === 'informes' && esAdmin ? (
            <div className="boletas-filters">
              <button
                type="button"
                className="boletas-btn info"
                disabled={busy || seleccionados.length === 0}
                onClick={() => void reenviarSeleccionados()}
              >
                <Mail size={16} aria-hidden />
                Reenviar seleccionados{seleccionados.length ? ` (${seleccionados.length})` : ''}
              </button>
            </div>
          ) : null}
          {tab === 'historial' ? (
            <div className="boletas-filters">
              <label>
                Buscar alumno
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Apellido o control" />
              </label>
              <button type="button" className="boletas-btn" onClick={() => void cargarVista('historial')}>
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
                  Materia
                  <select
                    value={historialMateriaId}
                    onChange={(e) => setHistorialMateriaId(Number(e.target.value))}
                  >
                    <option value={0}>Todas</option>
                    {asignaciones.map((a) => (
                      <option key={a.materia_id} value={a.materia_id}>
                        {a.materia_nombre}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {historialAlumnoId ? (
                <button
                  type="button"
                  className="boletas-btn download"
                  onClick={() =>
                    descargarPdf(
                      `/api/rac/impresion?modo=historial&alumnoId=${historialAlumnoId}&reporteTipo=${historialTipo}${
                        historialMateriaId ? `&materiaId=${historialMateriaId}` : ''
                      }`,
                      `rac-historial-${historialAlumnoId}.pdf`
                    )
                  }
                >
                  <Download size={16} aria-hidden />
                  Imprimir PDF
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="boletas-table-wrap">
            <table className="boletas-table">
              <thead>
                <tr>
                  {puedeSeleccionarMasivo ? (
                    <th className="rac-check-col">
                      <label className="rac-check">
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
                {lista.map((row, i) => {
                  const reporteId = Number(row.reporte_id)
                  return (
                  <tr key={String(row.reporte_id ?? row.cita_id ?? row.suspension_id ?? i)}>
                    {puedeSeleccionarMasivo ? (
                      <td className="rac-check-col">
                        <label className="rac-check">
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
                      <small className="rac-mini">
                        {String(row.alumno_ref ?? '')} {String(row.grado ?? '')}° {String(row.grupo ?? '')}
                      </small>
                    </td>
                    <td>
                      {String(row.escalon ?? row.tipoEtiqueta ?? row.materia ?? '')}
                      <span className="rac-mini">{String(row.motivo ?? row.mensaje ?? '')}</span>
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
                    <td className="rac-actions">
                      {puedeVerDetalleLista ? (
                        <button
                          type="button"
                          className="boletas-btn ghost rac-btn-icon"
                          title="Ver detalle del reporte / citatorio"
                          aria-label="Ver detalle"
                          onClick={() => setDetalleVista(row)}
                        >
                          <Search size={16} aria-hidden />
                          <span className="rac-btn-label">Detalle</span>
                        </button>
                      ) : null}
                      {tab === 'inbox' && me.role === 'psicologia' ? (
                        <>
                          <button type="button" className="boletas-btn success" onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'validar')}>
                            Aprobar
                          </button>
                          <button type="button" className="boletas-btn danger" onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'denegar')}>
                            Denegar
                          </button>
                        </>
                      ) : null}
                      {tab === 'inbox' && esAdmin ? (
                        <>
                          <button type="button" className="boletas-btn info" onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'reenviar')}>
                            Reenviar
                          </button>
                          <button type="button" className="boletas-btn success" onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'confirmar')}>
                            Confirmar
                          </button>
                          <button type="button" className="boletas-btn danger" onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'detener')}>
                            Detener
                          </button>
                        </>
                      ) : null}
                      {tab === 'informes' && esAdmin ? (
                        <button type="button" className="boletas-btn info" onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'reenviar')}>
                          Reenviar
                        </button>
                      ) : null}
                      {tab === 'citas' && (esAdmin || me.role === 'psicologia') ? (
                        <>
                          {esAdmin && Number(row.status) === 2 ? (
                            <button
                              type="button"
                              className="boletas-btn primary"
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
                          <button type="button" className="boletas-btn info" onClick={() => void accionCoord('cita', Number(row.cita_id), 'reenviar')}>
                            Reenviar
                          </button>
                          <button type="button" className="boletas-btn success" onClick={() => void accionCoord('cita', Number(row.cita_id), 'confirmar')}>
                            Enterado
                          </button>
                          {esAdmin ? (
                            <button type="button" className="boletas-btn danger" onClick={() => void accionCoord('cita', Number(row.cita_id), 'detener')}>
                              Anular
                            </button>
                          ) : null}
                        </>
                      ) : null}
                      {tab === 'suspensiones' && esAdmin ? (
                        <button
                          type="button"
                          className="boletas-btn primary"
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

      {detalleVista ? (
        <div className="rac-modal" role="dialog" aria-modal="true" aria-labelledby="rac-detalle-title">
          <div className="rac-modal-card rac-detalle-card">
            <h3 id="rac-detalle-title">Detalle</h3>
            <dl className="rac-detalle-dl">
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
                <dd className="rac-detalle-obs">{String(detalleVista.mensaje ?? '—')}</dd>
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
            <div className="rac-actions">
              <button type="button" className="boletas-btn primary" onClick={() => setDetalleVista(null)}>
                Aceptar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal ? (
        <div className="rac-modal" role="dialog" aria-modal="true">
          <div className="rac-modal-card">
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
              <p className="rac-mini">
                {me.role === 'psicologia'
                  ? 'No afecta el escalón de reportes del alumno.'
                  : 'Envía un informe sin afectar el número de reportes del alumno.'}
              </p>
            ) : null}
            <div className="boletas-filters">
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
            <label className="rac-msg">
              {modo === 'informe' ? 'Mensaje del informe' : 'Observaciones'}
              <textarea
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                rows={4}
                required
                placeholder={modo === 'informe' ? 'Redacte aquí su informe' : undefined}
              />
            </label>
            <div className="rac-actions">
              <button type="button" className="boletas-btn ghost" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button type="button" className="boletas-btn primary" disabled={busy} onClick={() => void enviarCaptura()}>
                <Send size={16} aria-hidden />
                Guardar y avisar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {citaValidar ? (
        <div className="rac-modal" role="dialog" aria-modal="true">
          <div className="rac-modal-card">
            <h3>Validar citatorio — {citaValidar.nombre}</h3>
            <p className="rac-mini">{citaValidar.tipoEtiqueta}</p>
            <div className="boletas-filters">
              <label>
                Fecha
                <input type="date" value={fechaCita} onChange={(e) => setFechaCita(e.target.value)} required />
              </label>
              <label>
                Hora
                <input type="time" value={horaCita} onChange={(e) => setHoraCita(e.target.value)} required />
              </label>
            </div>
            <label className="rac-msg">
              Mensaje
              <textarea
                value={mensaje || citaValidar.mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                rows={4}
              />
            </label>
            <div className="rac-actions">
              <button type="button" className="boletas-btn ghost" onClick={() => setCitaValidar(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="boletas-btn primary"
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

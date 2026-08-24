'use client'

import ThemeToggle from '@/components/ThemeToggle'
import { opcionesMotivo } from '@/lib/racUi'
import { etiquetaRol, tabsDeRol, tiposCapturaDeRol, type RacTab } from '@/lib/racPermisos'
import { ArrowLeft, LogOut, Send } from 'lucide-react'
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
      await api('/api/rac/auth/login', { method: 'POST', body: JSON.stringify({ usuario, password }) })
      onOk()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="rac-login-card" onSubmit={(ev) => void submit(ev)}>
      <p className="rac-login-kicker">Acceso docente</p>
      <h2>Ingresar a Secundaria</h2>
      <p className="rac-login-lead">
        Usa el usuario y contraseña del sistema de reportes de secundaria. Cada cuenta (maestro, psicología, prefectura, dirección o coordinación) abre su propio panel.
      </p>
      <label>
        Usuario
        <input
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          placeholder="Ej. eli"
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

  const asig = useMemo(() => {
    const [mid, letra] = asigKey.split('|')
    return asignaciones.find((a) => String(a.materia_id) === mid && a.grupo_letra === letra) ?? asignaciones[0]
  }, [asigKey, asignaciones])

  const tiposCaptura = useMemo(
    () => (me ? tiposCapturaDeRol(me.role, fisica) : []),
    [me, fisica]
  )
  const tabs = me ? tabsDeRol(me.role) : []

  const refreshMe = useCallback(async () => {
    try {
      const data = await api<{ me: Me; asignaciones: Asignacion[]; fisica?: boolean }>('/api/rac/sesion')
      setMe(data.me)
      setAsignaciones(data.asignaciones ?? [])
      setFisica(Boolean(data.fisica))
      if (data.asignaciones?.[0]) {
        setAsigKey(`${data.asignaciones[0].materia_id}|${data.asignaciones[0].grupo_letra}`)
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
      const data = await api<{ filas: AlumnoFila[] }>(
        `/api/rac/captura?materiaId=${asig.materia_id}&grupo=${encodeURIComponent(asig.grupo_letra)}&tipo=${tipo}`
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
      const data = await api<{ filas?: Record<string, unknown>[] }>(`/api/rac/coordinacion?vista=${vista}${extra}`)
      setLista(data.filas ?? [])
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
      await api('/api/rac/captura', {
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
      await api('/api/rac/coordinacion', {
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
    await api('/api/rac/auth/logout', { method: 'POST' })
    setMe(null)
  }

  const esAdmin = me?.role === 'coordinacion' || me?.role === 'direccion'
  const tiposSelect = tiposCaptura

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
            ? 'Módulo de conducta: reportar, aprobar reportes pendientes, citatorios y avisos de atención.'
            : me.role === 'prefectura'
              ? 'Prefectura: uniforme, vialidad y retardo.'
              : me.role === 'maestro'
                ? 'Captura de reportes de tu materia y seguimiento de citas.'
                : 'Panel de coordinación/dirección: listado, suspensión, citatorios, informes, captura e impresión.'}
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
                  <th></th>
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
                    <td>
                      <button
                        type="button"
                        className="boletas-btn primary"
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
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'inbox' || tab === 'citas' || tab === 'suspensiones' || tab === 'historial' || tab === 'informes' ? (
        <section className="boletas-panel">
          {tab === 'historial' ? (
            <div className="boletas-filters">
              <label>
                Buscar alumno
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Apellido o control" />
              </label>
              <button type="button" className="boletas-btn" onClick={() => void cargarVista('historial')}>
                Buscar
              </button>
            </div>
          ) : null}
          <div className="boletas-table-wrap">
            <table className="boletas-table">
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
                      <small className="rac-mini">
                        {String(row.alumno_ref ?? '')} {String(row.grado ?? '')}° {String(row.grupo ?? '')}
                      </small>
                    </td>
                    <td>
                      {String(row.escalon ?? row.tipoEtiqueta ?? row.materia ?? '')}
                      <span className="rac-mini">{String(row.motivo ?? row.mensaje ?? '')}</span>
                    </td>
                    <td>{String(row.fecha ?? '—')}</td>
                    <td className="rac-actions">
                      {tab === 'inbox' && me.role === 'psicologia' ? (
                        <>
                          <button type="button" className="boletas-btn primary" onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'validar')}>
                            Aprobar
                          </button>
                          <button type="button" className="boletas-btn" onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'denegar')}>
                            Denegar
                          </button>
                        </>
                      ) : null}
                      {tab === 'inbox' && esAdmin ? (
                        <>
                          <button type="button" className="boletas-btn" onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'reenviar')}>
                            Reenviar
                          </button>
                          <button type="button" className="boletas-btn" onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'confirmar')}>
                            Confirmar
                          </button>
                          <button type="button" className="boletas-btn" onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'detener')}>
                            Detener
                          </button>
                        </>
                      ) : null}
                      {tab === 'informes' && esAdmin ? (
                        <button type="button" className="boletas-btn" onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'reenviar')}>
                          Reenviar
                        </button>
                      ) : null}
                      {tab === 'citas' && (esAdmin || me.role === 'psicologia') ? (
                        <>
                          <button type="button" className="boletas-btn" onClick={() => void accionCoord('cita', Number(row.cita_id), 'reenviar')}>
                            Reenviar
                          </button>
                          <button type="button" className="boletas-btn" onClick={() => void accionCoord('cita', Number(row.cita_id), 'confirmar')}>
                            Enterado
                          </button>
                        </>
                      ) : null}
                      {tab === 'suspensiones' && esAdmin ? (
                        <button
                          type="button"
                          className="boletas-btn primary"
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
        <div className="rac-modal" role="dialog" aria-modal="true">
          <div className="rac-modal-card">
            <h3>{modal.nombre}</h3>
            <div className="boletas-filters">
              <label>
                Acción
                <select value={modo} onChange={(e) => setModo(e.target.value as typeof modo)}>
                  <option value="reporte">Reporte / aviso</option>
                  {me.role !== 'prefectura' ? <option value="informe">Informe</option> : null}
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
            <label className="rac-msg">
              Observaciones
              <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={4} required />
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
      </div>
    </div>
  )
}

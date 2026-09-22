'use client'

import ThemeToggle from '@/components/ThemeToggle'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
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
import { etiquetaTabConteo, opcionesMotivo } from '@/lib/racUi'
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
import { limpiarSesionGoogleCliente } from '@/lib/racLogoutClient'
import RacGoogleSignIn from './RacGoogleSignIn'
import RacDetalleModal from './RacDetalleModal'

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

type MarcasSeccion = { es: string; en: string }

type AlumnoFila = {
  alumno_id: number
  alumno_ref: string | number | null
  nombre: string
  nivel?: number
  grado: number
  grupo: string
  aviso: string
  r1: string
  r2: string
  r3: string
  /** Retardo Maternal/Kinder: escalones IV y V. */
  r4?: string
  r5?: string
  /** Académico MK/primaria: fechas por sección Español / Inglés. */
  academico?: {
    aviso: MarcasSeccion
    r1: MarcasSeccion
    r2: MarcasSeccion
    r3: MarcasSeccion
  }
}

type AlumnoBusqueda = {
  alumno_id: number
  alumno_ref: string | number | null
  alumno_app?: string | null
  alumno_apm?: string | null
  alumno_nombre?: string | null
  alumno_nivel?: number | string | null
  alumno_grado?: number | string | null
  alumno_grupo?: number | string | null
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
  const text = await res.text()
  let data = {} as T & { error?: string }
  try {
    data = text ? (JSON.parse(text) as T & { error?: string }) : ({} as T & { error?: string })
  } catch {
    data = {} as T & { error?: string }
  }
  if (!res.ok) {
    const raw = data.error || text || `Error ${res.status}`
    if (/<\s*html|bad gateway|502|503|504|openresty/i.test(raw) || res.status >= 502) {
      throw new Error(
        'El servicio de datos no respondió (error temporal). Espera unos segundos y pulsa Actualizar.'
      )
    }
    throw new Error(data.error || `Error ${res.status}`)
  }
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

/** Aviso / I / II / III académicos: Español (verde olivo) + Inglés (azul marino). */
function ChipFechaSecciones({ es, en }: MarcasSeccion) {
  const vacioEs = !es || es === '—' || es === '-'
  const vacioEn = !en || en === '—' || en === '-'
  return (
    <span className="racn-chip-pair" aria-label="Español e Inglés">
      <span
        className={vacioEs ? 'racn-chip racn-chip--empty racn-chip--es' : 'racn-chip racn-chip--es'}
        title="Español"
      >
        {vacioEs ? '—' : es}
      </span>
      <span
        className={vacioEn ? 'racn-chip racn-chip--empty racn-chip--en' : 'racn-chip racn-chip--en'}
        title="Inglés"
      >
        {vacioEn ? '—' : en}
      </span>
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
    <form className="racn-login-card" onSubmit={(ev) => void submit(ev)} autoComplete="off">
      <p className="racn-login-kicker">Acceso docente · {config.titulo}</p>
      <h2>Ingresar a {config.titulo}</h2>
      <p className="racn-login-lead">
        {config.slug === 'maternal-kinder'
          ? 'Maestro(a), Teacher, psicología o dirección/coordinación. Las docentes capturan académico, conducta (con visto bueno de psicología) y uniforme — no hay cuenta de prefecta en este nivel.'
          : config.slug === 'primaria'
            ? `Maestro(a), Teacher, psicología, ${config.etiquetaOperaciones.toLowerCase()} o dirección/coordinación. Las docentes capturan académico, conducta (con visto bueno de psicología) y uniforme.`
            : `Maestro(a), Teacher, psicología, ${config.etiquetaOperaciones.toLowerCase()} o dirección/coordinación.`}
        {config.modoGradoGrupo
          ? ' Los docentes entran con su grupo ya asignado — no eligen materia.'
          : ''}
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
          name={`rac-${config.slug}-usuario`}
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
          autoComplete="new-password"
          name={`rac-${config.slug}-clave`}
          required
        />
      </label>
      <p className="racn-login-hint">
        En PCs del salón: al terminar usa <strong>Salir</strong> (cerrar solo Google no basta). No guardes la contraseña en el navegador.
      </p>
      {error ? <p className="racn-login-error">{error}</p> : null}
      <button type="submit" className="racn-login-submit" disabled={loading}>
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
      <RacGoogleSignIn
        authUrl={`${config.apiBase}/auth/google`}
        onOk={onOk}
        classPrefix="racn"
      />
    </form>
  )
}

export default function RacNivelApp({ config, themeClass }: RacNivelAppProps) {
  const router = useRouter()
  const [boot, setBoot] = useState(true)
  const [me, setMe] = useState<Me | null>(null)
  const [loginKey, setLoginKey] = useState(0)
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
    alumno: {
      alumno_id: number
      alumno_ref: string | number | null
      nombre: string
      nivel?: number
      grado: number
      grupo: string
    }
    reportes: Record<string, unknown>[]
  } | null>(null)
  const [historialAlumnos, setHistorialAlumnos] = useState<AlumnoBusqueda[]>([])
  const [historialAlumnoId, setHistorialAlumnoId] = useState(0)
  const [historialTipo, setHistorialTipo] = useState(0)
  const [historialMateriaId, setHistorialMateriaId] = useState(0)
  const [historialSuggestOpen, setHistorialSuggestOpen] = useState(false)
  const [historialBuscando, setHistorialBuscando] = useState(false)
  const [printGrado, setPrintGrado] = useState(0)
  const [printGrupo, setPrintGrupo] = useState('')
  const [printNivel, setPrintNivel] = useState(0)
  const [seleccionados, setSeleccionados] = useState<number[]>([])
  /** Paridad secundaria_2.0: Informes filtro Confirmados / No confirmados / Todos. */
  const [informesConfirmado, setInformesConfirmado] = useState<'all' | '0' | '1'>('all')
  /** Citatorios: Confirmados / No confirmados / Todos. */
  const [citasConfirmado, setCitasConfirmado] = useState<'all' | '0' | '1'>('all')
  /** Citatorios: filtro por emisor (maestro / departamento). Vacío = todos. */
  const [citasMaestroKey, setCitasMaestroKey] = useState('')
  /** Listado: sin confirmar (legacy) / confirmados / todos los emitidos. */
  const [listadoConfirmado, setListadoConfirmado] = useState<'all' | '0' | '1'>('0')
  const [conteos, setConteos] = useState<
    Partial<Record<'inbox' | 'citas' | 'suspensiones' | 'informes' | 'captura', number>>
  >({})
  const puedeVerDetalleLista =
    tab === 'inbox' || tab === 'informes' || tab === 'citas' || tab === 'historial' || tab === 'suspensiones'

  const asig = useMemo(() => {
    const [mid, letra] = asigKey.split('|')
    return asignaciones.find((a) => String(a.materia_id) === mid && a.grupo_letra === letra) ?? asignaciones[0]
  }, [asigKey, asignaciones])

  const tiposCaptura = useMemo(
    () => (me ? tiposCapturaDeRolNivel(me.role, fisica, config) : []),
    [me, fisica, config]
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
      const tipos = tiposCapturaDeRolNivel(data.me.role, Boolean(data.fisica), config)
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
      setConteos((c) => ({ ...c, captura: data.filas.length }))
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setBusy(false)
    }
  }

  async function cargarVista(vista: string, confirmado?: 'all' | '0' | '1') {
    setBusy(true)
    setMsg('')
    try {
      let vistaApi = vista
      let conf = confirmado
      if (vista === 'inbox-listado') {
        if (listadoConfirmado === '0') {
          vistaApi = 'pendientes'
          conf = '0'
        } else if (listadoConfirmado === '1') {
          vistaApi = 'todos'
          conf = '1'
        } else {
          vistaApi = 'todos'
          conf = 'all'
        }
      } else if (vista === 'informes') {
        conf = confirmado ?? informesConfirmado
      } else if (vista === 'citas') {
        conf = confirmado ?? citasConfirmado
      }
      const confQs =
        conf === '0' || conf === '1' || conf === 'all' ? `&confirmado=${conf}` : ''
      const extra = vistaApi === 'historial' ? `&q=${encodeURIComponent(q)}` : confQs
      const data = await api<{ filas?: Record<string, unknown>[]; alumnos?: AlumnoBusqueda[] }>(
        `${config.apiBase}/coordinacion?vista=${vistaApi}${extra}`
      )
      const filas = data.filas ?? []
      setLista(filas)
      if (vista === 'inbox-listado') setConteos((c) => ({ ...c, inbox: filas.length }))
      if (vista === 'informes') setConteos((c) => ({ ...c, informes: filas.length }))
      if (vista === 'citas') setConteos((c) => ({ ...c, citas: filas.length }))
      if (vista === 'suspensiones') setConteos((c) => ({ ...c, suspensiones: filas.length }))
      if (vistaApi === 'historial') {
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

  const cargarConteosTabs = useCallback(async () => {
    if (!me) return
    const ids = new Set(tabsDeRolNivel(me.role, config).map((t) => t.id))
    const patch: Partial<Record<'inbox' | 'citas' | 'suspensiones' | 'informes', number>> = {}
    const jobs: Promise<void>[] = []
    const base = `${config.apiBase}/coordinacion`

    if (ids.has('inbox')) {
      let vistaApi = 'pendientes'
      let conf: 'all' | '0' | '1' = '0'
      if (listadoConfirmado === '1') {
        vistaApi = 'todos'
        conf = '1'
      } else if (listadoConfirmado === 'all') {
        vistaApi = 'todos'
        conf = 'all'
      }
      jobs.push(
        api<{ filas?: unknown[] }>(`${base}?vista=${vistaApi}&confirmado=${conf}`)
          .then((d) => {
            patch.inbox = d.filas?.length ?? 0
          })
          .catch(() => undefined)
      )
    }
    if (ids.has('informes')) {
      jobs.push(
        api<{ filas?: unknown[] }>(`${base}?vista=informes&confirmado=${informesConfirmado}`)
          .then((d) => {
            patch.informes = d.filas?.length ?? 0
          })
          .catch(() => undefined)
      )
    }
    if (ids.has('citas')) {
      jobs.push(
        api<{ filas?: unknown[] }>(`${base}?vista=citas&confirmado=${citasConfirmado}`)
          .then((d) => {
            patch.citas = d.filas?.length ?? 0
          })
          .catch(() => undefined)
      )
    }
    if (ids.has('suspensiones')) {
      jobs.push(
        api<{ filas?: unknown[] }>(`${base}?vista=suspensiones`)
          .then((d) => {
            patch.suspensiones = d.filas?.length ?? 0
          })
          .catch(() => undefined)
      )
    }
    if (!jobs.length) return
    await Promise.all(jobs)
    setConteos((c) => ({ ...c, ...patch }))
  }, [me, config, listadoConfirmado, informesConfirmado, citasConfirmado])

  useEffect(() => {
    if (!me) return
    void cargarConteosTabs()
  }, [me, cargarConteosTabs])

  useEffect(() => {
    if (!me) return
    if (tab === 'captura' || tab === 'control_escolar') void cargarGrupo()
    if (tab === 'inbox') void cargarVista('inbox-listado')
    if (tab === 'informes') void cargarVista('informes')
    if (tab === 'citas') void cargarVista('citas')
    if (tab === 'suspensiones') void cargarVista('suspensiones')
    if (tab === 'historial') {
      setLista([])
      setSeleccionados([])
      setHistorialAlumnos([])
      setHistorialAlumnoId(0)
      setHistorialMateriaId(0)
      setHistorialSuggestOpen(false)
      setQ('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, tab, asigKey, tipo, informesConfirmado, listadoConfirmado, citasConfirmado])

  useEffect(() => {
    if (tab !== 'historial' || !me) return
    const term = q.trim()
    if (term.length < 1) {
      setHistorialAlumnos([])
      setHistorialSuggestOpen(false)
      return
    }
    if (historialAlumnoId > 0) return
    const t = window.setTimeout(() => {
      void (async () => {
        setHistorialBuscando(true)
        try {
          const data = await api<{ alumnos?: AlumnoBusqueda[] }>(
            `${config.apiBase}/coordinacion?vista=historial&q=${encodeURIComponent(term)}`
          )
          setHistorialAlumnos(data.alumnos ?? [])
          setHistorialSuggestOpen(true)
        } catch (e) {
          setMsg(e instanceof Error ? e.message : 'Error al buscar alumnos')
        } finally {
          setHistorialBuscando(false)
        }
      })()
    }, 280)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tab, me, historialAlumnoId, config.apiBase])

  async function seleccionarAlumnoHistorial(a: AlumnoBusqueda) {
    const nombre = [a.alumno_app, a.alumno_apm, a.alumno_nombre].filter(Boolean).join(' ')
    setHistorialAlumnoId(Number(a.alumno_id))
    setQ(`${nombre} · ${a.alumno_ref ?? ''}`)
    setHistorialSuggestOpen(false)
    setHistorialAlumnos([])
    setHistorialMateriaId(0)
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
      }>(`${config.apiBase}/captura?historialAlumnoId=${a.alumno_id}`)
      setLista(data.reportes ?? [])
    } catch (e) {
      setLista([])
      setMsg(e instanceof Error ? e.message : 'No se pudo cargar el historial')
    } finally {
      setBusy(false)
    }
  }

  function limpiarAlumnoHistorial() {
    setHistorialAlumnoId(0)
    setLista([])
    setHistorialMateriaId(0)
    setQ('')
    setHistorialAlumnos([])
    setHistorialSuggestOpen(false)
  }

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
          tipo: modo === 'cita' ? tipoCita : tipo,
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
          `Guardado, pero el correo a la familia no salió: ${data.envio.error || 'error de envío'}. Se avisó a la cuenta institucional; puedes enviarlo desde «Avisos de atención» / bandeja con Enviar o Reenviar.`
        )
      } else {
        setMsg('Registro guardado y correo enviado a la familia.')
      }
      setModal(null)
      setMensaje('')
      await cargarGrupo()
      void cargarConteosTabs()
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
      const data = await api<{ ok?: boolean; error?: string }>(`${config.apiBase}/coordinacion`, {
        method: 'POST',
        body: JSON.stringify({ entidad, id, accion, ...extra }),
      })
      if (accion === 'reenviar' || (entidad === 'reporte' && accion === 'validar')) {
        if (data.ok === false) {
          setMsg(
            `No se pudo enviar el correo a la familia${data.error ? `: ${data.error}` : ''}. Ya se avisó a la cuenta institucional; reinténtalo con Enviar/Reenviar en la bandeja.`
          )
        } else {
          setMsg(
            entidad === 'cita'
              ? 'Citatorio enviado a la familia.'
              : accion === 'validar'
                ? 'Reporte aprobado y correo enviado a la familia.'
                : 'Correo enviado a la familia correctamente.'
          )
        }
      } else {
        setMsg(
          accion === 'confirmar'
            ? 'Marcado como enterado.'
            : accion === 'denegar'
              ? 'Reporte denegado.'
              : accion === 'detener'
                ? 'Registro detenido.'
                : 'Listo'
        )
      }
      setCitaValidar(null)
      if (tab === 'inbox') await cargarVista('inbox-listado')
      if (tab === 'informes') await cargarVista('informes')
      if (tab === 'citas') await cargarVista('citas')
      if (tab === 'suspensiones') await cargarVista('suspensiones')
      void cargarConteosTabs()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    try {
      await api(`${config.apiBase}/auth/logout`, { method: 'POST' })
    } catch {
      /* igual limpiamos el cliente */
    }
    limpiarSesionGoogleCliente()
    setMe(null)
    setAsignaciones([])
    setFilas([])
    setLista([])
    setConteos({})
    setAsigKey('')
    setQ('')
    setMsg('')
    setModal(null)
    setLoginKey((k) => k + 1)
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

  function urlPdfPendientes() {
    const params = new URLSearchParams({ modo: 'pendientes' })
    if (printGrado > 0) params.set('grado', String(printGrado))
    if (printGrupo) params.set('grupo', printGrupo)
    if (printNivel > 0) params.set('nivel', String(printNivel))
    return `${config.apiBase}/impresion?${params.toString()}`
  }

  const esAdmin = Boolean(me && esPanelAdminNivel(me.role, config))
  const esMaestro = me?.role === 'maestro'
  const unSoloGrupo = esMaestro && asignaciones.length === 1
  const sinAsignaciones = asignaciones.length === 0
  const puedeSeleccionarMasivo = Boolean(
    (esAdmin && (tab === 'inbox' || tab === 'informes')) ||
      (me?.role === 'psicologia' && tab === 'informes')
  )
  const capturaConInformeYCita =
    esAdmin || me?.role === 'psicologia' || me?.role === 'maestro'
  const capturaConInforme = capturaConInformeYCita
  /** Retardo en Maternal/Kinder: escalón I–V (resto de tipos/niveles siguen en 3). */
  const retardoMkCinco = config.slug === 'maternal-kinder' && tipo === 6
  const puedePdf = Boolean(me && puedePdfNivel(me.role, config))
  const opcionesMaestrosCitas = useMemo(() => {
    if (tab !== 'citas') return [] as { key: string; label: string }[]
    const map = new Map<string, string>()
    for (const r of lista) {
      const key = String(r.emisor_key ?? `${Number(r.perfil_id) || 0}:${Number(r.usuario_id) || 0}`)
      if (!key || key === '0:0') continue
      const depto = String(r.emisor_departamento || r.emisor || '').trim()
      const nombre = String(r.emisor_nombre ?? '').trim()
      const label = nombre ? (depto ? `${depto} — ${nombre}` : nombre) : depto || key
      if (!map.has(key)) map.set(key, label)
    }
    return [...map.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [lista, tab])

  const listaVisible =
    tab === 'historial'
      ? lista.filter((r) => {
          if (historialAlumnoId && Number(r.alumno_id) !== historialAlumnoId) return false
          // 0 = Todos (kardex completo).
          if (historialTipo !== 0 && Number(r.tipo) !== historialTipo) return false
          if (historialTipo === 1 && historialMateriaId > 0 && Number(r.materia_id) !== historialMateriaId) {
            return false
          }
          return true
        })
      : tab === 'citas' && citasMaestroKey
        ? lista.filter((r) => {
            const key = String(r.emisor_key ?? `${Number(r.perfil_id) || 0}:${Number(r.usuario_id) || 0}`)
            return key === citasMaestroKey
          })
        : lista

  const materiasHistorial = useMemo(() => {
    const map = new Map<number, string>()
    for (const r of lista) {
      if (Number(r.tipo) !== 1) continue
      const id = Number(r.materia_id)
      const nombre = String(r.materia ?? '').trim()
      if (id > 0 && nombre) map.set(id, nombre)
    }
    return [...map.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [lista])
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
        const data = await api<{ ok?: boolean }>(`${config.apiBase}/coordinacion`, {
          method: 'POST',
          body: JSON.stringify({ entidad: 'reporte', id, accion: 'reenviar' }),
        })
        if (data.ok === false) fail += 1
        else ok += 1
      } catch {
        fail += 1
      }
    }
    setMsg(
      fail
        ? `Enviados: ${ok} · No enviados: ${fail}. Por cada fallo se avisó a la cuenta institucional.`
        : `Correo enviado a la familia correctamente (${ok}).`
    )
    setSeleccionados([])
    try {
      if (tab === 'inbox') await cargarVista('inbox-listado')
      if (tab === 'informes') await cargarVista('informes')
    } finally {
      setBusy(false)
    }
  }

  const stats = useMemo(() => {
    const conReporte = filas.filter(
      (f) => f.aviso || f.r1 || f.r2 || f.r3 || f.r4 || f.r5
    ).length
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
          <LoginPanel key={loginKey} config={config} onOk={() => void refreshMe()} />
          <p className="racn-login-shared-hint">
            PC compartida: usa <strong>Salir</strong> al terminar tu turno.
          </p>
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
          {tabs.map((t) => {
            const n =
              t.id === 'historial'
                ? undefined
                : t.id === 'control_escolar'
                  ? conteos.captura
                  : conteos[t.id as keyof typeof conteos]
            return (
              <button
                key={t.id}
                type="button"
                className={tab === t.id ? 'active' : ''}
                onClick={() => setTab(t.id)}
              >
                {etiquetaTabConteo(t.label, n)}
              </button>
            )
          })}
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
              {tipo === 1 ? (
                <p className="racn-legend-secciones" role="note">
                  <span className="racn-chip racn-chip--es">Español</span>
                  <span className="racn-chip racn-chip--en">Inglés</span>
                  Aviso e I–III van por sección (Maestra / Teacher). La suspensión académica aplica al
                  cumplir 1 aviso + 3 reportes en la misma sección.
                </p>
              ) : null}
              {retardoMkCinco ? (
                <p className="racn-legend-secciones" role="note">
                  Retardos en Maternal/Kinder: hasta <strong>5</strong> reportes (I–V). Al 5.º se genera
                  la suspensión.
                </p>
              ) : null}
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
                      <th title={tipo === 1 ? 'Español (verde olivo) · Inglés (azul marino)' : undefined}>
                        Aviso
                      </th>
                      <th title={tipo === 1 ? 'Español · Inglés' : undefined}>I</th>
                      <th title={tipo === 1 ? 'Español · Inglés' : undefined}>II</th>
                      <th title={tipo === 1 ? 'Español · Inglés' : undefined}>III</th>
                      {retardoMkCinco ? (
                        <>
                          <th>IV</th>
                          <th>V</th>
                        </>
                      ) : null}
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
                        <td colSpan={retardoMkCinco ? 8 : 6} className="racn-empty-row">
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
                                  {a.alumno_ref ?? '—'} ·{' '}
                                  {etiquetaGradoEscolar(
                                    a.nivel ?? (config.slug === 'primaria' ? 3 : 2),
                                    a.grado
                                  ) || String(a.grado ?? '')}{' '}
                                  {a.grupo}
                                </small>
                              </span>
                            </div>
                          </td>
                          <td>
                            {a.academico ? (
                              <ChipFechaSecciones es={a.academico.aviso.es} en={a.academico.aviso.en} />
                            ) : (
                              <ChipFecha valor={a.aviso || '—'} />
                            )}
                          </td>
                          <td>
                            {a.academico ? (
                              <ChipFechaSecciones es={a.academico.r1.es} en={a.academico.r1.en} />
                            ) : (
                              <ChipFecha valor={a.r1 || '—'} />
                            )}
                          </td>
                          <td>
                            {a.academico ? (
                              <ChipFechaSecciones es={a.academico.r2.es} en={a.academico.r2.en} />
                            ) : (
                              <ChipFecha valor={a.r2 || '—'} />
                            )}
                          </td>
                          <td>
                            {a.academico ? (
                              <ChipFechaSecciones es={a.academico.r3.es} en={a.academico.r3.en} />
                            ) : (
                              <ChipFecha valor={a.r3 || '—'} />
                            )}
                          </td>
                          {retardoMkCinco ? (
                            <>
                              <td>
                                <ChipFecha valor={a.r4 || '—'} />
                              </td>
                              <td>
                                <ChipFecha valor={a.r5 || '—'} />
                              </td>
                            </>
                          ) : null}
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
                                  if (me.role === 'psicologia') {
                                    setMotivo(opcionesMotivo(8)[0]?.valor ?? 1)
                                  }
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
                                  setTipoCita(
                                    me.role === 'psicologia'
                                      ? (tiposCita[0]?.valor ?? 2)
                                      : tipo
                                  )
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
                <label>
                  Filtro
                  <select
                    value={listadoConfirmado}
                    onChange={(e) => setListadoConfirmado(e.target.value as 'all' | '0' | '1')}
                  >
                    <option value="0">Sin confirmar</option>
                    <option value="1">Confirmados histórico</option>
                    <option value="all">Todos los emitidos</option>
                  </select>
                </label>
                {puedePdf ? (
                  <button
                    type="button"
                    className="racn-btn download"
                    onClick={() =>
                      descargarPdf(urlPdfPendientes(), `rac-${config.slug}-pendientes.pdf`)
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
            {tab === 'informes' && (esAdmin || me?.role === 'psicologia') ? (
              <div className="racn-filters">
                <label>
                  Filtro
                  <select
                    value={informesConfirmado}
                    onChange={(e) => setInformesConfirmado(e.target.value as 'all' | '0' | '1')}
                  >
                    <option value="all">Todos</option>
                    <option value="1">Confirmados histórico</option>
                    <option value="0">No confirmados</option>
                  </select>
                </label>
                <p className="rac-print-legend">
                  Solo informes de aprendizaje. Académico, uniforme y demás → Listado sin confirmar.
                </p>
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
            {tab === 'citas' ? (
              <div className="racn-filters">
                <label>
                  Confirmación
                  <select
                    value={citasConfirmado}
                    onChange={(e) => {
                      setCitasConfirmado(e.target.value as 'all' | '0' | '1')
                      setCitasMaestroKey('')
                    }}
                  >
                    <option value="all">Todos</option>
                    <option value="0">No confirmados</option>
                    <option value="1">Confirmados</option>
                  </select>
                </label>
                <label>
                  Maestro / emisor
                  <select
                    value={citasMaestroKey}
                    onChange={(e) => setCitasMaestroKey(e.target.value)}
                  >
                    <option value="">Todos</option>
                    {opcionesMaestrosCitas.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            {tab === 'historial' ? (
              <>
                {puedePdf ? (
                  <div className="racn-filters rac-print-block">
                    <p className="rac-print-legend">Impresión de reportes sin confirmar</p>
                    <label>
                      Grado
                      <select
                        value={printNivel > 0 ? `${printNivel}|${printGrado}` : printGrado > 0 ? String(printGrado) : '0'}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === '0') {
                            setPrintGrado(0)
                            setPrintNivel(0)
                            return
                          }
                          if (v.includes('|')) {
                            const [niv, gr] = v.split('|').map(Number)
                            setPrintNivel(niv)
                            setPrintGrado(gr)
                          } else {
                            setPrintNivel(0)
                            setPrintGrado(Number(v))
                          }
                        }}
                      >
                        <option value="0">Todos</option>
                        {config.gradosFallback.map((g) => {
                          const key =
                            config.slug === 'maternal-kinder'
                              ? `${g.nivelEscolar}|${g.grado}`
                              : String(g.grado)
                          return (
                            <option key={key} value={key}>
                              {etiquetaGradoEscolar(g.nivelEscolar, g.grado)}
                            </option>
                          )
                        })}
                      </select>
                    </label>
                    <label>
                      Grupo
                      <select value={printGrupo} onChange={(e) => setPrintGrupo(e.target.value)}>
                        <option value="">Todos</option>
                        {config.gruposCaptura.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="racn-btn download"
                      onClick={() =>
                        descargarPdf(urlPdfPendientes(), `rac-${config.slug}-pendientes.pdf`)
                      }
                    >
                      <Download size={16} aria-hidden />
                      Imprimir reportes sin confirmar
                    </button>
                  </div>
                ) : null}
                <div className="racn-filters">
                  <p className="rac-print-legend">Historial por alumno</p>
                  <label className="rac-autocomplete">
                    Buscar alumno
                    <input
                      value={q}
                      onChange={(e) => {
                        setQ(e.target.value)
                        if (historialAlumnoId) {
                          setHistorialAlumnoId(0)
                          setLista([])
                          setHistorialMateriaId(0)
                        }
                        setHistorialSuggestOpen(true)
                      }}
                      onFocus={() => {
                        if (historialAlumnos.length && !historialAlumnoId) setHistorialSuggestOpen(true)
                      }}
                      onBlur={() => {
                        window.setTimeout(() => setHistorialSuggestOpen(false), 160)
                      }}
                      placeholder="Escribe apellido, nombre o control"
                      autoComplete="off"
                      aria-autocomplete="list"
                      aria-expanded={historialSuggestOpen}
                    />
                    {historialSuggestOpen && !historialAlumnoId ? (
                      <ul className="rac-suggest" role="listbox">
                        {historialBuscando ? (
                          <li className="rac-suggest__empty">Buscando…</li>
                        ) : historialAlumnos.length === 0 ? (
                          <li className="rac-suggest__empty">
                            {q.trim().length < 1 ? 'Escribe para buscar' : 'Sin coincidencias'}
                          </li>
                        ) : (
                          historialAlumnos.map((a) => {
                            const nombre = [a.alumno_app, a.alumno_apm, a.alumno_nombre]
                              .filter(Boolean)
                              .join(' ')
                            return (
                              <li key={a.alumno_id}>
                                <button
                                  type="button"
                                  role="option"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => void seleccionarAlumnoHistorial(a)}
                                >
                                  <strong>{nombre}</strong>
                                  <span>
                                    Control {a.alumno_ref ?? '—'}
                                    {a.alumno_grado != null
                                      ? ` · ${
                                          etiquetaGradoEscolar(
                                            a.alumno_nivel ?? (config.slug === 'primaria' ? 3 : 2),
                                            a.alumno_grado
                                          ) || String(a.alumno_grado)
                                        }`
                                      : ''}
                                  </span>
                                </button>
                              </li>
                            )
                          })
                        )}
                      </ul>
                    ) : null}
                  </label>
                  {historialAlumnoId ? (
                    <button type="button" className="racn-btn ghost" onClick={limpiarAlumnoHistorial}>
                      Cambiar alumno
                    </button>
                  ) : null}
                  <label>
                    Tipo de reporte
                    <select
                      value={historialTipo}
                      onChange={(e) => {
                        setHistorialTipo(Number(e.target.value))
                        setHistorialMateriaId(0)
                      }}
                    >
                      <option value={0}>Todos</option>
                      <option value={1}>Académico</option>
                      <option value={2}>Conducta</option>
                      <option value={3}>Uniforme</option>
                      <option value={4}>Vialidad</option>
                      <option value={5}>Informe</option>
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
                        {materiasHistorial.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nombre}
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
                            historialTipo === 1 && historialMateriaId
                              ? `&materiaId=${historialMateriaId}`
                              : ''
                          }`,
                          `rac-${config.slug}-historial-${historialAlumnoId}.pdf`
                        )
                      }
                    >
                      <Download size={16} aria-hidden />
                      Imprimir historial PDF
                    </button>
                  ) : null}
                </div>
                {!historialAlumnoId ? (
                  <p className="rac-print-hint">
                    Escribe el nombre o número de control; elige un alumno de la lista para ver su historial e
                    imprimirlo.
                  </p>
                ) : null}
              </>
            ) : null}
            {tab !== 'historial' || historialAlumnoId > 0 ? (
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
                    {tab === 'citas' ? <th>Expedido por</th> : null}
                    {tab === 'suspensiones' ? <th>Sección</th> : null}
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
                            {String(row.alumno_ref ?? '')}{' '}
                            {row.grado != null
                              ? etiquetaGradoEscolar(
                                  (row.nivel as number | string | null | undefined) ??
                                    (config.slug === 'primaria' ? 3 : 2),
                                  row.grado as number | string
                                ) || String(row.grado)
                              : ''}{' '}
                            {String(row.grupo ?? '')}
                          </small>
                        </td>
                    <td>
                      {String(row.escalon ?? row.tipoEtiqueta ?? row.materia ?? '')}
                      {row.materia ? (
                        <span className="racn-mini">Materia: {String(row.materia)}</span>
                      ) : null}
                      <span className="racn-mini">{String(row.motivo ?? row.mensaje ?? '')}</span>
                    </td>
                    {tab === 'citas' ? (
                      <td>
                        {String(row.emisor_departamento || row.emisor || '—')}
                        {row.emisor_nombre ? (
                          <span className="racn-mini">{String(row.emisor_nombre)}</span>
                        ) : null}
                      </td>
                    ) : null}
                    {tab === 'suspensiones' ? (
                      <td>
                        {row.seccion === 'es' || row.seccion === 'en' ? (
                          <span
                            className={
                              row.seccion === 'en'
                                ? 'racn-chip racn-chip--en'
                                : 'racn-chip racn-chip--es'
                            }
                            title={
                              row.seccion === 'en'
                                ? 'Límite académico en Inglés (Teacher)'
                                : 'Límite académico en Español (Maestra)'
                            }
                          >
                            {String(row.seccionEtiqueta || (row.seccion === 'en' ? 'Inglés' : 'Español'))}
                          </span>
                        ) : (
                          <span className="racn-chip racn-chip--empty">—</span>
                        )}
                      </td>
                    ) : null}
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
                          {tab === 'informes' && (esAdmin || me.role === 'psicologia') ? (
                            <button
                              type="button"
                              className="racn-btn info"
                              title={
                                Number(row.enviado) === 1
                                  ? 'Volver a enviar el aviso a la familia'
                                  : 'Enviar el aviso a la familia (aún no salió)'
                              }
                              onClick={() => void accionCoord('reporte', Number(row.reporte_id), 'reenviar')}
                            >
                              <Mail size={16} aria-hidden />
                              {Number(row.enviado) === 1 ? 'Reenviar' : 'Enviar'}
                            </button>
                          ) : null}
                          {tab === 'citas' &&
                          (esAdmin || me.role === 'psicologia' || me.role === 'maestro') ? (
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
                                const seccionLbl = String(row.seccionEtiqueta ?? '').trim()
                                const hint = seccionLbl
                                  ? `Fecha de suspensión académica — ${seccionLbl} (AAAA-MM-DD)`
                                  : 'Fecha de suspensión (AAAA-MM-DD)'
                                const fecha = window.prompt(hint)
                                if (fecha) {
                                  void accionCoord('suspension', Number(row.suspension_id), 'aplicar', {
                                    fecha,
                                  })
                                }
                              }}
                            >
                              {row.seccionEtiqueta
                                ? `Aplicar fecha (${String(row.seccionEtiqueta)})`
                                : 'Aplicar fecha'}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            ) : null}
          </section>
        ) : null}

        {historialKardex ? (
          <div className="racn-modal" role="dialog" aria-modal="true" aria-labelledby="racn-historial-title">
            <div className="racn-modal-card racn-detalle-card">
              <h3 id="racn-historial-title">Historial de reportes</h3>
              <p className="racn-mini">
                {historialKardex.alumno.nombre} · {String(historialKardex.alumno.alumno_ref ?? '—')} ·{' '}
                {etiquetaGradoEscolar(
                  historialKardex.alumno.nivel ?? (config.slug === 'primaria' ? 3 : 2),
                  historialKardex.alumno.grado
                ) || String(historialKardex.alumno.grado ?? '')}{' '}
                {historialKardex.alumno.grupo}
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

        {detalleVista ? <RacDetalleModal row={detalleVista} onClose={() => setDetalleVista(null)} /> : null}

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
                    ? 'Elige el Motivo que verá la familia. El detalle de la situación va en Observaciones. No afecta el escalón de reportes.'
                    : 'Envía un informe sin afectar el número de reportes del alumno.'}
                </p>
              ) : null}
              <div className="racn-filters">
                {modo === 'reporte' || (modo === 'informe' && me?.role === 'psicologia') ? (
                  <label>
                    Motivo
                    <select value={motivo} onChange={(e) => setMotivo(Number(e.target.value))}>
                      {opcionesMotivo(modo === 'informe' ? 8 : tipo).map((o) => (
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
                      Tipo de citatorio
                      <select value={tipoCita} onChange={(e) => setTipoCita(Number(e.target.value))}>
                        {tiposCita.map((t) => (
                          <option key={t.valor} value={t.valor}>
                            {t.etiqueta}
                          </option>
                        ))}
                      </select>
                    </label>
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

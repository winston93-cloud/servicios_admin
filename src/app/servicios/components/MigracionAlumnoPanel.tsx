'use client'

import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react'
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Cloud,
  Coffee,
  Database,
  Eraser,
  GitCompareArrows,
  GraduationCap,
  KeyRound,
  Loader2,
  Minus,
  RefreshCw,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react'
import {
  GRUPOS_MIGRACION,
  TABLAS_MIGRACION,
  type TablaMigracion,
} from '@/lib/migracionTablasManifest'
import type {
  ModoMigracion,
  ResultadoMigracionTablas,
  ResultadoTablaMigracion,
} from '@/lib/migracionTablasService'
import type {
  ResultadoTablaVerificacion,
  ResultadoVerificacionEspejo,
} from '@/lib/migracionTablasVerificacion'
import MigracionConfirmModal, {
  type TipoConfirmacionMigracion,
} from '@/app/servicios/components/MigracionConfirmModal'

interface EstadoConfig {
  listo: boolean
  requiereSecreto: boolean
  mysql: { host: string; database: string; port: number } | null
}

type EstadoFilaProgreso =
  | 'pendiente'
  | 'activa'
  | 'ok'
  | 'omitida'
  | 'error'
  | 'discordancia'

type TipoOperacion = 'migrar' | 'verificar'

interface ProgresoMigracion {
  tipo: TipoOperacion
  total: number
  completadas: number
  tablaActual: string | null
  tablaActualEtiqueta: string | null
  filas: Record<string, EstadoFilaProgreso>
}

const GRUPO_ICON: Record<TablaMigracion['grupo'], ComponentType<{ size?: number; className?: string }>> = {
  catalogos: BookOpen,
  alumnos: Users,
  pagos: Wallet,
  boletas: GraduationCap,
  desayunos: Coffee,
  sistema: Settings,
}

const MODOS_INFO: Record<
  ModoMigracion,
  { titulo: string; desc: string; Icon: ComponentType<{ size?: number }>; badge?: string }
> = {
  espejo: {
    titulo: 'Espejo',
    desc: 'Inserta, actualiza y elimina huérfanos para igualar phpMyAdmin.',
    Icon: GitCompareArrows,
    badge: 'Recomendado',
  },
  solo_upsert: {
    titulo: 'Solo upsert',
    desc: 'Inserta o actualiza filas sin borrar extras en Supabase.',
    Icon: RefreshCw,
  },
  vaciar_copiar: {
    titulo: 'Vaciar y copiar',
    desc: 'Borra la tabla destino y recarga todo desde cero.',
    Icon: Eraser,
  },
}

function ordenarSeleccion(ids: Set<string>): TablaMigracion[] {
  return TABLAS_MIGRACION.filter((t) => ids.has(t.id))
}

function formatoDuracion(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  const s = Math.round(ms / 100) / 10
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`
}

function estadoGrupo(ids: string[], seleccion: Set<string>): 'todos' | 'ninguno' | 'parcial' {
  const n = ids.filter((id) => seleccion.has(id)).length
  if (n === 0) return 'ninguno'
  if (n === ids.length) return 'todos'
  return 'parcial'
}

export default function MigracionAlumnoPanel() {
  const [config, setConfig] = useState<EstadoConfig | null>(null)
  const [secreto, setSecreto] = useState('')
  const [modo, setModo] = useState<ModoMigracion>('espejo')
  const [seleccion, setSeleccion] = useState<Set<string>>(
    () => new Set(TABLAS_MIGRACION.map((t) => t.id))
  )
  const [cargando, setCargando] = useState(false)
  const [operacion, setOperacion] = useState<TipoOperacion | null>(null)
  const [progreso, setProgreso] = useState<ProgresoMigracion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoMigracionTablas | null>(null)
  const [resultadoVerificacion, setResultadoVerificacion] =
    useState<ResultadoVerificacionEspejo | null>(null)
  const [confirmacion, setConfirmacion] = useState<TipoConfirmacionMigracion | null>(null)

  useEffect(() => {
    fetch('/api/migracion-tablas')
      .then((r) => r.json())
      .then((d) => setConfig(d as EstadoConfig))
      .catch(() => setConfig({ listo: false, requiereSecreto: false, mysql: null }))
  }, [])

  const porGrupo = useMemo(() => {
    const map = new Map<TablaMigracion['grupo'], TablaMigracion[]>()
    for (const t of TABLAS_MIGRACION) {
      const lista = map.get(t.grupo) ?? []
      lista.push(t)
      map.set(t.grupo, lista)
    }
    return map
  }, [])

  const toggleTabla = (id: string) => {
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleGrupo = (grupo: TablaMigracion['grupo']) => {
    const ids = TABLAS_MIGRACION.filter((t) => t.grupo === grupo).map((t) => t.id)
    setSeleccion((prev) => {
      const todos = ids.every((id) => prev.has(id))
      const next = new Set(prev)
      for (const id of ids) {
        if (todos) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  const solicitarMigrar = () => {
    if (seleccion.size === 0) {
      setError('Selecciona al menos una tabla.')
      return
    }
    setError(null)
    setConfirmacion('migrar')
  }

  const solicitarVerificar = () => {
    if (seleccion.size === 0) {
      setError('Selecciona al menos una tabla.')
      return
    }
    setError(null)
    setConfirmacion('verificar')
  }

  const ejecutarMigracion = useCallback(async () => {
    setConfirmacion(null)
    setCargando(true)
    setOperacion('migrar')
    setError(null)
    setResultado(null)
    setResultadoVerificacion(null)

    const ordenadas = ordenarSeleccion(seleccion)
    const total = ordenadas.length
    const estadosIniciales = Object.fromEntries(
      ordenadas.map((t) => [t.id, 'pendiente' as EstadoFilaProgreso])
    ) as Record<string, EstadoFilaProgreso>

    setProgreso({
      tipo: 'migrar',
      total,
      completadas: 0,
      tablaActual: ordenadas[0]?.id ?? null,
      tablaActualEtiqueta: ordenadas[0]?.etiqueta ?? null,
      filas: estadosIniciales,
    })

    const inicio = Date.now()
    const tablasAcumuladas: ResultadoTablaMigracion[] = []
    const erroresGlobales: string[] = []
    let mysqlMeta: ResultadoMigracionTablas['mysql'] | null = null

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (secreto.trim()) headers['x-migracion-secret'] = secreto.trim()

      for (let i = 0; i < ordenadas.length; i++) {
        const def = ordenadas[i]
        setProgreso((prev) =>
          prev
            ? {
                ...prev,
                tablaActual: def.id,
                tablaActualEtiqueta: def.etiqueta,
                filas: { ...prev.filas, [def.id]: 'activa' },
              }
            : prev
        )

        const res = await fetch('/api/migracion-tablas', {
          method: 'POST',
          headers,
          body: JSON.stringify({ modo, tablas: [def.id] }),
        })
        const data = (await res.json()) as ResultadoMigracionTablas & { error?: string }

        if (!res.ok) throw new Error(data.error ?? res.statusText)

        if (data.mysql) mysqlMeta = data.mysql
        if (data.tablas?.length) tablasAcumuladas.push(...data.tablas)
        if (data.erroresGlobales?.length) erroresGlobales.push(...data.erroresGlobales)

        const fila = data.tablas?.[0]
        const estadoFila: EstadoFilaProgreso =
          fila?.estado === 'error' ? 'error' : fila?.estado === 'omitida' ? 'omitida' : 'ok'

        setProgreso((prev) =>
          prev
            ? {
                ...prev,
                completadas: i + 1,
                tablaActual: ordenadas[i + 1]?.id ?? null,
                tablaActualEtiqueta: ordenadas[i + 1]?.etiqueta ?? null,
                filas: { ...prev.filas, [def.id]: estadoFila },
              }
            : prev
        )
      }

      const resultadoFinal: ResultadoMigracionTablas = {
        ok: erroresGlobales.length === 0,
        duracionMs: Date.now() - inicio,
        modo,
        mysql: mysqlMeta ?? { host: '—', database: '—', port: 3306 },
        tablas: tablasAcumuladas,
        erroresGlobales,
      }

      setResultado(resultadoFinal)
      if (!resultadoFinal.ok) {
        setError(erroresGlobales.join(' · ') || 'Migración con errores parciales')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al migrar')
    } finally {
      setCargando(false)
      setOperacion(null)
      setProgreso(null)
    }
  }, [modo, secreto, seleccion])

  const ejecutarVerificacion = useCallback(async () => {
    setConfirmacion(null)
    setCargando(true)
    setOperacion('verificar')
    setError(null)
    setResultado(null)
    setResultadoVerificacion(null)

    const ordenadas = ordenarSeleccion(seleccion)
    const total = ordenadas.length
    const estadosIniciales = Object.fromEntries(
      ordenadas.map((t) => [t.id, 'pendiente' as EstadoFilaProgreso])
    ) as Record<string, EstadoFilaProgreso>

    setProgreso({
      tipo: 'verificar',
      total,
      completadas: 0,
      tablaActual: ordenadas[0]?.id ?? null,
      tablaActualEtiqueta: ordenadas[0]?.etiqueta ?? null,
      filas: estadosIniciales,
    })

    const inicio = Date.now()
    const tablasAcumuladas: ResultadoTablaVerificacion[] = []
    const erroresGlobales: string[] = []
    let mysqlMeta: ResultadoVerificacionEspejo['mysql'] | null = null

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (secreto.trim()) headers['x-migracion-secret'] = secreto.trim()

      for (let i = 0; i < ordenadas.length; i++) {
        const def = ordenadas[i]
        setProgreso((prev) =>
          prev
            ? {
                ...prev,
                tablaActual: def.id,
                tablaActualEtiqueta: def.etiqueta,
                filas: { ...prev.filas, [def.id]: 'activa' },
              }
            : prev
        )

        const res = await fetch('/api/migracion-tablas/verificar', {
          method: 'POST',
          headers,
          body: JSON.stringify({ tablas: [def.id] }),
        })
        const data = (await res.json()) as ResultadoVerificacionEspejo & { error?: string }

        if (!res.ok) throw new Error(data.error ?? res.statusText)

        if (data.mysql) mysqlMeta = data.mysql
        if (data.tablas?.length) tablasAcumuladas.push(...data.tablas)
        if (data.erroresGlobales?.length) erroresGlobales.push(...data.erroresGlobales)

        const fila = data.tablas?.[0]
        let estadoFila: EstadoFilaProgreso = 'ok'
        if (fila?.estado === 'error') estadoFila = 'error'
        else if (fila?.estado === 'omitida') estadoFila = 'omitida'
        else if (fila?.estado === 'discordancia') estadoFila = 'discordancia'

        setProgreso((prev) =>
          prev
            ? {
                ...prev,
                completadas: i + 1,
                tablaActual: ordenadas[i + 1]?.id ?? null,
                tablaActualEtiqueta: ordenadas[i + 1]?.etiqueta ?? null,
                filas: { ...prev.filas, [def.id]: estadoFila },
              }
            : prev
        )
      }

      const conDiscordancia = tablasAcumuladas.some((t) => t.estado === 'discordancia')
      const conError = tablasAcumuladas.some((t) => t.estado === 'error')

      const resultadoFinal: ResultadoVerificacionEspejo = {
        ok: !conDiscordancia && !conError && erroresGlobales.length === 0,
        duracionMs: Date.now() - inicio,
        mysql: mysqlMeta ?? { host: '—', database: '—', port: 3306 },
        tablas: tablasAcumuladas,
        erroresGlobales,
      }

      setResultadoVerificacion(resultadoFinal)
      if (!resultadoFinal.ok) {
        setError(
          conDiscordancia
            ? 'Verificación terminada con discordancias entre MySQL y Supabase'
            : erroresGlobales.join(' · ') || 'Verificación con errores parciales'
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al verificar')
    } finally {
      setCargando(false)
      setOperacion(null)
      setProgreso(null)
    }
  }, [secreto, seleccion])

  const porcentajeProgreso = useMemo(() => {
    if (!progreso || progreso.total === 0) return 0
    return Math.round((progreso.completadas / progreso.total) * 100)
  }, [progreso])

  const totalesVerificacion = useMemo(() => {
    if (!resultadoVerificacion) return null
    return resultadoVerificacion.tablas.reduce(
      (acc, t) => ({
        mysql: acc.mysql + t.mysqlCount,
        supabase: acc.supabase + t.supabaseCount,
        faltan: acc.faltan + t.faltanEnSupabase,
        sobran: acc.sobran + t.sobranEnSupabase,
        distintas: acc.distintas + t.contenidoDistinto,
      }),
      { mysql: 0, supabase: 0, faltan: 0, sobran: 0, distintas: 0 }
    )
  }, [resultadoVerificacion])

  const totales = useMemo(() => {
    if (!resultado) return null
    return resultado.tablas.reduce(
      (acc, t) => ({
        origen: acc.origen + t.origen,
        insertados: acc.insertados + t.insertados,
        actualizados: acc.actualizados + t.actualizados,
        sinCambios: acc.sinCambios + t.sinCambios,
        eliminados: acc.eliminados + t.eliminados,
      }),
      { origen: 0, insertados: 0, actualizados: 0, sinCambios: 0, eliminados: 0 }
    )
  }, [resultado])

  const accionesDeshabilitadas = cargando || config?.listo === false || seleccion.size === 0

  return (
    <>
      <div className="migracion-pro" aria-label="Migración MySQL → Supabase">
        {/* Hero */}
        <header className="migracion-pro-hero">
          <div className="migracion-pro-hero-copy">
            <span className="migracion-pro-kicker">
              <Sparkles size={14} aria-hidden />
              Sincronización de datos
            </span>
            <h2 className="migracion-pro-hero-title">MySQL → Supabase</h2>
            <p className="migracion-pro-hero-lead">
              Replica tablas de phpMyAdmin hacia Supabase desde el servidor Vercel. Tras migrar en
              modo espejo, audita con verificación de conteos, PKs y contenido de negocio.
            </p>
          </div>

          <div className="migracion-pro-pipeline" aria-hidden>
            <div className="migracion-pro-node migracion-pro-node--mysql">
              <Database size={22} />
              <span>MySQL</span>
              <small>{config?.mysql?.database ?? 'winston_general'}</small>
            </div>
            <div className="migracion-pro-arrow">
              <ArrowRight size={20} />
            </div>
            <div className="migracion-pro-node migracion-pro-node--supabase">
              <Cloud size={22} />
              <span>Supabase</span>
              <small>PostgreSQL</small>
            </div>
          </div>

          <div className="migracion-pro-badges">
            <span
              className={`migracion-pro-badge${config?.listo ? ' migracion-pro-badge--ok' : ' migracion-pro-badge--warn'}`}
            >
              <span className="migracion-pro-badge-dot" aria-hidden />
              {config?.listo ? 'MySQL configurado' : 'MySQL pendiente'}
            </span>
            {config?.mysql && (
              <span className="migracion-pro-badge">
                <Server size={13} aria-hidden />
                {config.mysql.host}:{config.mysql.port}
              </span>
            )}
            <span className="migracion-pro-badge migracion-pro-badge--accent">
              {seleccion.size} / {TABLAS_MIGRACION.length} tablas
            </span>
          </div>
        </header>

        {config && !config.listo && (
          <div className="migracion-pro-banner migracion-pro-banner--error" role="alert">
            <AlertCircle size={18} aria-hidden />
            <div>
              <strong>Falta configuración MySQL en Vercel.</strong> Agrega MYSQL_HOST, MYSQL_USER,
              MYSQL_PASSWORD y MYSQL_DATABASE en Project → Settings → Environment Variables.
            </div>
          </div>
        )}

        <div className="migracion-pro-layout">
          {/* Sidebar: config + modos */}
          <aside className="migracion-pro-sidebar">
            {config?.requiereSecreto && (
              <section className="migracion-pro-card">
                <h3 className="migracion-pro-card-title">
                  <KeyRound size={16} aria-hidden />
                  Secreto de migración
                </h3>
                <p className="migracion-pro-card-hint">Variable MIGRACION_SECRET en Vercel</p>
                <input
                  type="password"
                  value={secreto}
                  onChange={(e) => setSecreto(e.target.value)}
                  className="migracion-pro-input"
                  placeholder="••••••••••••"
                  autoComplete="off"
                />
              </section>
            )}

            <section className="migracion-pro-card">
              <h3 className="migracion-pro-card-title">Modo de sincronización</h3>
              <div className="migracion-pro-modos" role="radiogroup" aria-label="Modo de sincronización">
                {(Object.keys(MODOS_INFO) as ModoMigracion[]).map((id) => {
                  const info = MODOS_INFO[id]
                  const activo = modo === id
                  const Icon = info.Icon
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      className={`migracion-pro-modo${activo ? ' migracion-pro-modo--activo' : ''}${id === 'vaciar_copiar' ? ' migracion-pro-modo--peligro' : ''}`}
                      onClick={() => setModo(id)}
                    >
                      <span className="migracion-pro-modo-icono" aria-hidden>
                        <Icon size={18} />
                      </span>
                      <span className="migracion-pro-modo-texto">
                        <span className="migracion-pro-modo-titulo">
                          {info.titulo}
                          {info.badge && (
                            <span className="migracion-pro-modo-badge">{info.badge}</span>
                          )}
                        </span>
                        <span className="migracion-pro-modo-desc">{info.desc}</span>
                      </span>
                      <span className="migracion-pro-modo-check" aria-hidden>
                        {activo && <Check size={14} strokeWidth={3} />}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="migracion-pro-card migracion-pro-card--tip">
              <p>
                Las columnas <code>*_actualizacion</code> las gestiona Postgres con triggers; la
                verificación las ignora a propósito.
              </p>
            </section>
          </aside>

          {/* Main: tablas */}
          <main className="migracion-pro-main">
            <div className="migracion-pro-main-head">
              <div>
                <h3 className="migracion-pro-main-title">Tablas a procesar</h3>
                <p className="migracion-pro-main-sub">
                  {seleccion.size} seleccionada{seleccion.size === 1 ? '' : 's'} de{' '}
                  {TABLAS_MIGRACION.length}
                </p>
              </div>
              <div className="migracion-pro-quick">
                <button
                  type="button"
                  className="migracion-pro-quick-btn"
                  onClick={() => setSeleccion(new Set(TABLAS_MIGRACION.map((t) => t.id)))}
                >
                  Todas
                </button>
                <button
                  type="button"
                  className="migracion-pro-quick-btn"
                  onClick={() => setSeleccion(new Set())}
                >
                  Ninguna
                </button>
              </div>
            </div>

            <div className="migracion-pro-grupos">
              {([...porGrupo.entries()] as [TablaMigracion['grupo'], TablaMigracion[]][]).map(
                ([grupo, tablas]) => {
                  const ids = tablas.map((t) => t.id)
                  const estado = estadoGrupo(ids, seleccion)
                  const GrupoIcon = GRUPO_ICON[grupo]
                  const selCount = ids.filter((id) => seleccion.has(id)).length

                  return (
                    <section key={grupo} className="migracion-pro-grupo">
                      <button
                        type="button"
                        className="migracion-pro-grupo-head"
                        onClick={() => toggleGrupo(grupo)}
                        aria-pressed={estado === 'todos'}
                      >
                        <span
                          className={`migracion-pro-check migracion-pro-check--grupo migracion-pro-check--${estado}`}
                          aria-hidden
                        >
                          {estado === 'todos' && <Check size={12} strokeWidth={3} />}
                          {estado === 'parcial' && <Minus size={12} strokeWidth={3} />}
                        </span>
                        <span className="migracion-pro-grupo-icono" aria-hidden>
                          <GrupoIcon size={16} />
                        </span>
                        <span className="migracion-pro-grupo-nombre">{GRUPOS_MIGRACION[grupo]}</span>
                        <span className="migracion-pro-grupo-count">
                          {selCount}/{tablas.length}
                        </span>
                      </button>

                      <ul className="migracion-pro-tablas">
                        {tablas.map((t) => {
                          const activa = seleccion.has(t.id)
                          return (
                            <li key={t.id}>
                              <button
                                type="button"
                                className={`migracion-pro-fila${activa ? ' migracion-pro-fila--activa' : ''}`}
                                onClick={() => toggleTabla(t.id)}
                                aria-pressed={activa}
                              >
                                <span
                                  className={`migracion-pro-check${activa ? ' migracion-pro-check--on' : ''}`}
                                  aria-hidden
                                >
                                  {activa && <Check size={11} strokeWidth={3} />}
                                </span>
                                <span className="migracion-pro-tabla-info">
                                  <span className="migracion-pro-tabla-nombre">{t.etiqueta}</span>
                                  <span className="migracion-pro-tabla-ruta">
                                    {t.mysql} → {t.supabase}
                                  </span>
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </section>
                  )
                }
              )}
            </div>
          </main>
        </div>

        {/* Progreso */}
        {cargando && progreso && (
          <section
            className="migracion-pro-progreso"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="migracion-pro-progreso-top">
              <div>
                <p className="migracion-pro-progreso-label">
                  {progreso.tipo === 'verificar' ? 'Verificando espejo' : 'Migrando tablas'}
                </p>
                <p className="migracion-pro-progreso-tabla">
                  {progreso.tablaActualEtiqueta ?? 'Finalizando…'}
                </p>
              </div>
              <span className="migracion-pro-progreso-pct">{porcentajeProgreso}%</span>
            </div>
            <div
              className="migracion-pro-progreso-bar"
              role="progressbar"
              aria-valuenow={porcentajeProgreso}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="migracion-pro-progreso-fill"
                style={{ width: `${porcentajeProgreso}%` }}
              />
            </div>
            <ul className="migracion-pro-progreso-lista">
              {ordenarSeleccion(seleccion).map((t) => {
                const est = progreso.filas[t.id] ?? 'pendiente'
                return (
                  <li key={t.id} className={`migracion-pro-progreso-item migracion-pro-progreso-item--${est}`}>
                    {est === 'activa' && <Loader2 className="migracion-pro-spin" size={13} aria-hidden />}
                    {est === 'ok' && <CheckCircle2 size={13} aria-hidden />}
                    {est === 'discordancia' && <span aria-hidden>≠</span>}
                    {est === 'omitida' && <Minus size={13} aria-hidden />}
                    {est === 'error' && <XCircle size={13} aria-hidden />}
                    {est === 'pendiente' && <span className="migracion-pro-progreso-dot" aria-hidden />}
                    {t.etiqueta}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* Acciones sticky */}
        <footer className="migracion-pro-footer">
          <div className="migracion-pro-footer-info">
            <strong>{seleccion.size}</strong> tabla{seleccion.size === 1 ? '' : 's'} · modo{' '}
            <strong>{MODOS_INFO[modo].titulo}</strong>
          </div>
          <div className="migracion-pro-footer-btns">
            <button
              type="button"
              className="migracion-pro-btn migracion-pro-btn--ghost"
              disabled={accionesDeshabilitadas}
              onClick={solicitarVerificar}
            >
              {cargando && operacion === 'verificar' ? (
                <>
                  <Loader2 className="migracion-pro-spin" size={17} aria-hidden />
                  Verificando…
                </>
              ) : (
                <>
                  <ShieldCheck size={17} aria-hidden />
                  Verificar espejo
                </>
              )}
            </button>
            <button
              type="button"
              className="migracion-pro-btn migracion-pro-btn--primary"
              disabled={accionesDeshabilitadas}
              onClick={solicitarMigrar}
            >
              {cargando && operacion === 'migrar' ? (
                <>
                  <Loader2 className="migracion-pro-spin" size={17} aria-hidden />
                  Migrando…
                </>
              ) : (
                <>
                  <GitCompareArrows size={17} aria-hidden />
                  Migrar {seleccion.size} tabla{seleccion.size === 1 ? '' : 's'}
                </>
              )}
            </button>
          </div>
        </footer>

        {error && (
          <div className="migracion-pro-banner migracion-pro-banner--error" role="alert">
            <AlertCircle size={18} aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {/* Resultados migración */}
        {resultado && (
          <section className="migracion-pro-resultado">
            <header className={`migracion-pro-resultado-head${resultado.ok ? ' migracion-pro-resultado-head--ok' : ''}`}>
              <CheckCircle2 size={20} aria-hidden />
              <div>
                <h3>{resultado.ok ? 'Migración completada' : 'Migración con errores'}</h3>
                <p>
                  {formatoDuracion(resultado.duracionMs)} · modo {resultado.modo}
                </p>
              </div>
            </header>

            {totales && (
              <div className="migracion-pro-stats">
                <div className="migracion-pro-stat">
                  <span className="migracion-pro-stat-val">{totales.origen.toLocaleString()}</span>
                  <span className="migracion-pro-stat-lbl">Origen</span>
                </div>
                <div className="migracion-pro-stat migracion-pro-stat--insert">
                  <span className="migracion-pro-stat-val">{totales.insertados.toLocaleString()}</span>
                  <span className="migracion-pro-stat-lbl">Insertados</span>
                </div>
                <div className="migracion-pro-stat migracion-pro-stat--update">
                  <span className="migracion-pro-stat-val">{totales.actualizados.toLocaleString()}</span>
                  <span className="migracion-pro-stat-lbl">Actualizados</span>
                </div>
                <div className="migracion-pro-stat">
                  <span className="migracion-pro-stat-val">{totales.sinCambios.toLocaleString()}</span>
                  <span className="migracion-pro-stat-lbl">Sin cambios</span>
                </div>
                <div className="migracion-pro-stat migracion-pro-stat--delete">
                  <span className="migracion-pro-stat-val">{totales.eliminados.toLocaleString()}</span>
                  <span className="migracion-pro-stat-lbl">Eliminados</span>
                </div>
              </div>
            )}

            <div className="migracion-pro-tabla-wrap">
              <table className="migracion-pro-tabla">
                <thead>
                  <tr>
                    <th>Tabla</th>
                    <th>Estado</th>
                    <th>MySQL</th>
                    <th>+ Insert</th>
                    <th>↻ Update</th>
                    <th>= Igual</th>
                    <th>− Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.tablas.map((t) => (
                    <tr key={t.id} className={`migracion-pro-tr--${t.estado}`}>
                      <td>
                        <strong>{t.etiqueta}</strong>
                        <span className="migracion-pro-tabla-ruta">{t.supabase}</span>
                      </td>
                      <td>
                        <span className={`migracion-pro-estado migracion-pro-estado--${t.estado}`}>
                          {t.estado === 'ok' && 'OK'}
                          {t.estado === 'omitida' && 'Omitida'}
                          {t.estado === 'error' && 'Error'}
                        </span>
                      </td>
                      <td>{t.origen.toLocaleString()}</td>
                      <td>{t.insertados.toLocaleString()}</td>
                      <td>{t.actualizados.toLocaleString()}</td>
                      <td>{t.sinCambios.toLocaleString()}</td>
                      <td>{t.eliminados.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {resultado.tablas.some((t) => t.mensaje) && (
              <ul className="migracion-pro-detalles">
                {resultado.tablas
                  .filter((t) => t.mensaje)
                  .map((t) => (
                    <li key={t.id}>
                      <strong>{t.etiqueta}:</strong> {t.mensaje}
                    </li>
                  ))}
              </ul>
            )}
          </section>
        )}

        {/* Resultados verificación */}
        {resultadoVerificacion && (
          <section className="migracion-pro-resultado">
            <header
              className={`migracion-pro-resultado-head${resultadoVerificacion.ok ? ' migracion-pro-resultado-head--ok' : ' migracion-pro-resultado-head--warn'}`}
            >
              <ShieldCheck size={20} aria-hidden />
              <div>
                <h3>
                  {resultadoVerificacion.ok
                    ? 'Espejo verificado'
                    : 'Verificación con discordancias'}
                </h3>
                <p>{formatoDuracion(resultadoVerificacion.duracionMs)}</p>
              </div>
            </header>

            {totalesVerificacion && (
              <div className="migracion-pro-stats">
                <div className="migracion-pro-stat">
                  <span className="migracion-pro-stat-val">{totalesVerificacion.mysql.toLocaleString()}</span>
                  <span className="migracion-pro-stat-lbl">MySQL esperado</span>
                </div>
                <div className="migracion-pro-stat">
                  <span className="migracion-pro-stat-val">{totalesVerificacion.supabase.toLocaleString()}</span>
                  <span className="migracion-pro-stat-lbl">Supabase</span>
                </div>
                <div className="migracion-pro-stat migracion-pro-stat--warn">
                  <span className="migracion-pro-stat-val">{totalesVerificacion.faltan.toLocaleString()}</span>
                  <span className="migracion-pro-stat-lbl">Faltan</span>
                </div>
                <div className="migracion-pro-stat migracion-pro-stat--warn">
                  <span className="migracion-pro-stat-val">{totalesVerificacion.sobran.toLocaleString()}</span>
                  <span className="migracion-pro-stat-lbl">Sobran</span>
                </div>
                <div className="migracion-pro-stat migracion-pro-stat--warn">
                  <span className="migracion-pro-stat-val">{totalesVerificacion.distintas.toLocaleString()}</span>
                  <span className="migracion-pro-stat-lbl">≠ Contenido</span>
                </div>
              </div>
            )}

            <div className="migracion-pro-tabla-wrap">
              <table className="migracion-pro-tabla">
                <thead>
                  <tr>
                    <th>Tabla</th>
                    <th>Estado</th>
                    <th>MySQL</th>
                    <th>Supabase</th>
                    <th>Faltan</th>
                    <th>Sobran</th>
                    <th>≠ Contenido</th>
                  </tr>
                </thead>
                <tbody>
                  {resultadoVerificacion.tablas.map((t) => (
                    <tr key={t.id} className={`migracion-pro-tr--${t.estado}`}>
                      <td>
                        <strong>{t.etiqueta}</strong>
                        <span className="migracion-pro-tabla-ruta">{t.supabase}</span>
                      </td>
                      <td>
                        <span className={`migracion-pro-estado migracion-pro-estado--${t.estado}`}>
                          {t.estado === 'ok' && 'OK'}
                          {t.estado === 'discordancia' && 'Discordancia'}
                          {t.estado === 'omitida' && 'Omitida'}
                          {t.estado === 'error' && 'Error'}
                        </span>
                      </td>
                      <td>{t.mysqlCount.toLocaleString()}</td>
                      <td>{t.supabaseCount.toLocaleString()}</td>
                      <td>{t.faltanEnSupabase.toLocaleString()}</td>
                      <td>{t.sobranEnSupabase.toLocaleString()}</td>
                      <td>{t.contenidoDistinto.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {resultadoVerificacion.tablas.some(
              (t) =>
                t.mensaje ||
                t.muestraFaltan.length > 0 ||
                t.muestraSobran.length > 0 ||
                t.muestraDistintas.length > 0
            ) && (
              <ul className="migracion-pro-detalles">
                {resultadoVerificacion.tablas.map((t) => {
                  const partes: string[] = []
                  if (t.mensaje) partes.push(t.mensaje)
                  if (t.muestraFaltan.length > 0) {
                    partes.push(
                      `PK faltan (muestra): ${t.muestraFaltan.join(', ')}${t.faltanEnSupabase > t.muestraFaltan.length ? '…' : ''}`
                    )
                  }
                  if (t.muestraSobran.length > 0) {
                    partes.push(
                      `PK sobran (muestra): ${t.muestraSobran.join(', ')}${t.sobranEnSupabase > t.muestraSobran.length ? '…' : ''}`
                    )
                  }
                  for (const d of t.muestraDistintas) {
                    partes.push(`PK ${d.pk}: campos distintos → ${d.campos.join(', ')}`)
                  }
                  if (partes.length === 0) return null
                  return (
                    <li key={t.id}>
                      <strong>{t.etiqueta}:</strong> {partes.join(' · ')}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}
      </div>

      <MigracionConfirmModal
        abierto={confirmacion !== null}
        tipo={confirmacion ?? 'migrar'}
        cantidadTablas={seleccion.size}
        modo={modo}
        mysqlDatabase={config?.mysql?.database}
        onCancelar={() => setConfirmacion(null)}
        onConfirmar={confirmacion === 'verificar' ? ejecutarVerificacion : ejecutarMigracion}
      />
    </>
  )
}

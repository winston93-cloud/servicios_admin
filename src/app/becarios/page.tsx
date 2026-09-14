'use client'

import ThemeToggle from '@/components/ThemeToggle'
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  LogOut,
  NotebookPen,
  Save,
  Sparkles,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import './becarios.css'

type BecarioCard = {
  username: string
  nombre: string
  iniciales: string
  accent: 'sky' | 'violet'
}

type Entrada = {
  entrada_id?: number
  entrada_fecha: string
  entrada_titulo: string
  avances: string
  observaciones: string
  apuntes: string
  pendientes: string
  aprendizajes: string
  horas_aproximadas: number | null
  estado: string
}

const EMPTY: Entrada = {
  entrada_fecha: '',
  entrada_titulo: '',
  avances: '',
  observaciones: '',
  apuntes: '',
  pendientes: '',
  aprendizajes: '',
  horas_aproximadas: null,
  estado: 'publicado',
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error || 'Error de red')
  return data
}

function fmtFechaLarga(iso: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function BecariosPage() {
  const router = useRouter()
  const [boot, setBoot] = useState(true)
  const [me, setMe] = useState<{ username: string; nombre: string } | null>(null)
  const [becarios, setBecarios] = useState<BecarioCard[]>([])
  const [pick, setPick] = useState<string>('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'hoy' | 'historial' | 'reportes'>('hoy')
  const [form, setForm] = useState<Entrada>(EMPTY)
  const [lista, setLista] = useState<Entrada[]>([])
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [dirty, setDirty] = useState(false)

  const refreshMe = useCallback(async () => {
    try {
      const data = await api<{ me: { username: string; nombre: string } }>('/api/becarios/auth/me')
      setMe(data.me)
      return data.me
    } catch {
      setMe(null)
      return null
    }
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const catalog = await api<{ becarios: BecarioCard[] }>('/api/becarios/auth/login')
        setBecarios(catalog.becarios || [])
      } catch {
        /* ignore */
      }
      await refreshMe()
      setBoot(false)
    })()
  }, [refreshMe])

  const cargarDia = useCallback(async (fecha: string) => {
    setBusy(true)
    setMsg('')
    try {
      const data = await api<{ entrada: Entrada | null; hoy: string }>(
        `/api/becarios/bitacora?fecha=${encodeURIComponent(fecha)}`
      )
      if (data.entrada) {
        setForm({
          ...EMPTY,
          ...data.entrada,
          horas_aproximadas: data.entrada.horas_aproximadas ?? null,
        })
      } else {
        setForm({ ...EMPTY, entrada_fecha: fecha })
      }
      setDirty(false)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo cargar')
    } finally {
      setBusy(false)
    }
  }, [])

  const cargarHistorial = useCallback(async (d: string, h: string) => {
    setBusy(true)
    setMsg('')
    try {
      const q = new URLSearchParams()
      if (d) q.set('desde', d)
      if (h) q.set('hasta', h)
      const data = await api<{ entradas: Entrada[]; desde: string; hasta: string }>(
        `/api/becarios/bitacora?${q.toString()}`
      )
      setLista(data.entradas || [])
      if (data.desde) setDesde(data.desde)
      if (data.hasta) setHasta(data.hasta)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo cargar el historial')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (!me) return
    if (tab === 'hoy') {
      void (async () => {
        try {
          const list = await api<{ hoy: string }>('/api/becarios/bitacora')
          await cargarDia(form.entrada_fecha || list.hoy)
        } catch (e) {
          setMsg(e instanceof Error ? e.message : 'No se pudo cargar')
        }
      })()
    }
    if (tab === 'historial' || tab === 'reportes') {
      void cargarHistorial(desde, hasta)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, tab])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    if (!pick) {
      setMsg('Elige tu nombre para entrar.')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      await api('/api/becarios/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: pick, password }),
      })
      setPassword('')
      await refreshMe()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'No se pudo entrar')
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    try {
      await api('/api/becarios/auth/me', { method: 'POST' })
    } catch {
      /* igual limpiamos el cliente */
    }
    setMe(null)
    setPick('')
    setPassword('')
    setForm(EMPTY)
    setLista([])
    setMsg('')
  }

  function patchForm(partial: Partial<Entrada>) {
    setForm((prev) => ({ ...prev, ...partial }))
    setDirty(true)
  }

  async function guardar() {
    setBusy(true)
    setMsg('')
    try {
      const data = await api<{ entrada: Entrada }>('/api/becarios/bitacora', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      setForm({ ...EMPTY, ...data.entrada })
      setDirty(false)
      setMsg('Bitácora guardada.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  function descargar(formato: 'pdf' | 'xlsx', periodo: 'dia' | 'semana' | 'rango') {
    const q = new URLSearchParams({ formato, periodo })
    if (periodo === 'dia') q.set('fecha', form.entrada_fecha || hasta || desde)
    else if (periodo === 'semana') q.set('fecha', form.entrada_fecha || hasta || desde)
    else {
      if (desde) q.set('desde', desde)
      if (hasta) q.set('hasta', hasta)
    }
    window.open(`/api/becarios/reporte?${q.toString()}`, '_blank')
  }

  const resumenSemana = useMemo(() => {
    const horas = lista.reduce((acc, e) => acc + (Number(e.horas_aproximadas) || 0), 0)
    return { n: lista.length, horas }
  }, [lista])

  if (boot) {
    return (
      <div className="becarios-page">
        <div className="becarios-bg" aria-hidden />
        <p className="becarios-boot">Cargando bitácora…</p>
      </div>
    )
  }

  if (!me) {
    return (
      <div className="becarios-page">
        <div className="becarios-bg" aria-hidden />
        <div className="becarios-shell becarios-shell--login">
          <header className="becarios-login-head">
            <button type="button" className="becarios-back" onClick={() => router.push('/dashboard')}>
              <ArrowLeft size={18} aria-hidden />
              Dashboard
            </button>
            <ThemeToggle />
          </header>
          <div className="becarios-login-card">
            <div className="becarios-kicker">
              <Sparkles size={16} aria-hidden /> Winston · Becarios
            </div>
            <h1>Bitácora diaria</h1>
            <p className="becarios-lead">
              Elige tu nombre e ingresa. Registra avances, observaciones y apuntes con la claridad
              que el equipo necesita cada día.
            </p>
            <form className="becarios-login-form" onSubmit={(e) => void login(e)} autoComplete="off">
              <div className="becarios-pick-grid" role="listbox" aria-label="Becarios">
                {becarios.map((b) => (
                  <button
                    key={b.username}
                    type="button"
                    role="option"
                    aria-selected={pick === b.username}
                    className={`becarios-pick ${pick === b.username ? 'is-on' : ''}`}
                    data-accent={b.accent}
                    onClick={() => setPick(b.username)}
                  >
                    <span className="becarios-avatar">{b.iniciales}</span>
                    <span className="becarios-pick-name">{b.nombre}</span>
                  </button>
                ))}
              </div>
              <label className="becarios-field">
                Contraseña
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  name="becarios-clave"
                  required
                  placeholder="Tu clave de becario"
                />
              </label>
              <p className="becarios-login-hint">
                En PC compartida: al terminar usa <strong>Salir</strong>. No guardes la contraseña en el navegador.
              </p>
              {msg ? <p className="becarios-msg">{msg}</p> : null}
              <button type="submit" className="becarios-btn primary" disabled={busy || !pick}>
                Entrar a mi bitácora
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="becarios-page">
      <div className="becarios-bg" aria-hidden />
      <div className="becarios-shell">
        <header className="becarios-top">
          <div className="becarios-top-left">
            <button type="button" className="becarios-back" onClick={() => router.push('/dashboard')}>
              <ArrowLeft size={18} aria-hidden />
              <span>Dashboard</span>
            </button>
            <div className="becarios-who">
              <span className="becarios-avatar sm">{me.nombre.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{me.nombre}</strong>
                <small>Bitácora de becario</small>
              </div>
            </div>
          </div>
          <div className="becarios-top-right">
            <ThemeToggle />
            <button type="button" className="becarios-btn ghost" onClick={() => void logout()}>
              <LogOut size={16} aria-hidden />
              Salir
            </button>
          </div>
        </header>

        <nav className="becarios-tabs" aria-label="Secciones">
          <button
            type="button"
            className={tab === 'hoy' ? 'is-on' : ''}
            onClick={() => setTab('hoy')}
          >
            <NotebookPen size={16} aria-hidden />
            Hoy
          </button>
          <button
            type="button"
            className={tab === 'historial' ? 'is-on' : ''}
            onClick={() => setTab('historial')}
          >
            <CalendarDays size={16} aria-hidden />
            Historial
          </button>
          <button
            type="button"
            className={tab === 'reportes' ? 'is-on' : ''}
            onClick={() => setTab('reportes')}
          >
            <BookOpen size={16} aria-hidden />
            Reportes
          </button>
        </nav>

        {msg ? <p className="becarios-msg banner">{msg}</p> : null}

        {tab === 'hoy' ? (
          <section className="becarios-panel">
            <div className="becarios-panel-head">
              <div>
                <span className="becarios-kicker">Captura del día</span>
                <h2>Registro del día</h2>
                <p className="becarios-date-line">{fmtFechaLarga(form.entrada_fecha)}</p>
              </div>
              <label className="becarios-field inline">
                Fecha
                <input
                  type="date"
                  value={form.entrada_fecha}
                  onChange={(e) => {
                    const f = e.target.value
                    patchForm({ entrada_fecha: f })
                    void cargarDia(f)
                  }}
                />
              </label>
            </div>

            <div className="becarios-form-grid">
              <label className="becarios-field span-2">
                Título del día (opcional)
                <input
                  type="text"
                  value={form.entrada_titulo}
                  onChange={(e) => patchForm({ entrada_titulo: e.target.value })}
                  placeholder="Ej. Migración de reportes / apoyo en caja / revisión de portal"
                />
              </label>
              <label className="becarios-field">
                Horas aproximadas
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={form.horas_aproximadas ?? ''}
                  onChange={(e) =>
                    patchForm({
                      horas_aproximadas: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="4"
                />
              </label>
              <label className="becarios-field span-2">
                Avances del día *
                <textarea
                  rows={7}
                  value={form.avances}
                  onChange={(e) => patchForm({ avances: e.target.value })}
                  placeholder="¿Qué hiciste hoy? Sé concreto: tareas, módulos, tickets, pruebas, reuniones…"
                  required
                />
              </label>
              <label className="becarios-field">
                Observaciones
                <textarea
                  rows={5}
                  value={form.observaciones}
                  onChange={(e) => patchForm({ observaciones: e.target.value })}
                  placeholder="Bloqueos, dudas, decisiones, contexto útil para el equipo…"
                />
              </label>
              <label className="becarios-field">
                Apuntes técnicos
                <textarea
                  rows={5}
                  value={form.apuntes}
                  onChange={(e) => patchForm({ apuntes: e.target.value })}
                  placeholder="Comandos, URLs, snippets, hallazgos, links de PRs…"
                />
              </label>
              <label className="becarios-field">
                Pendientes para mañana
                <textarea
                  rows={4}
                  value={form.pendientes}
                  onChange={(e) => patchForm({ pendientes: e.target.value })}
                  placeholder="Siguientes pasos claros…"
                />
              </label>
              <label className="becarios-field">
                Aprendizajes
                <textarea
                  rows={4}
                  value={form.aprendizajes}
                  onChange={(e) => patchForm({ aprendizajes: e.target.value })}
                  placeholder="Qué aprendiste hoy (herramientas, procesos, dominio escolar)…"
                />
              </label>
            </div>

            <div className="becarios-actions">
              <span className="becarios-dirty">{dirty ? 'Cambios sin guardar' : 'Al día'}</span>
              <button
                type="button"
                className="becarios-btn primary"
                disabled={busy}
                onClick={() => void guardar()}
              >
                <Save size={16} aria-hidden />
                Guardar bitácora
              </button>
            </div>
          </section>
        ) : null}

        {tab === 'historial' ? (
          <section className="becarios-panel">
            <div className="becarios-panel-head">
              <div>
                <span className="becarios-kicker">Consulta</span>
                <h2>Historial</h2>
                <p className="becarios-date-line">Filtra por fecha o intervalo.</p>
              </div>
            </div>
            <div className="becarios-filters">
              <label className="becarios-field">
                Desde
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </label>
              <label className="becarios-field">
                Hasta
                <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </label>
              <button
                type="button"
                className="becarios-btn primary"
                disabled={busy}
                onClick={() => void cargarHistorial(desde, hasta)}
              >
                Filtrar
              </button>
            </div>
            <div className="becarios-stats">
              <div>
                <strong>{resumenSemana.n}</strong>
                <span>registros</span>
              </div>
              <div>
                <strong>{resumenSemana.horas || '—'}</strong>
                <span>horas sumadas</span>
              </div>
            </div>
            <div className="becarios-timeline">
              {lista.length === 0 ? (
                <p className="becarios-empty">Sin entradas en ese periodo.</p>
              ) : (
                lista.map((e) => (
                  <article key={`${e.entrada_fecha}-${e.entrada_id}`} className="becarios-card-entry">
                    <header>
                      <time dateTime={e.entrada_fecha}>{fmtFechaLarga(e.entrada_fecha)}</time>
                      {e.horas_aproximadas != null ? (
                        <span className="becarios-chip">{e.horas_aproximadas} h</span>
                      ) : null}
                    </header>
                    {e.entrada_titulo ? <h3>{e.entrada_titulo}</h3> : null}
                    <p className="becarios-clip">{e.avances}</p>
                    <button
                      type="button"
                      className="becarios-btn ghost"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, entrada_fecha: e.entrada_fecha }))
                        setTab('hoy')
                      }}
                    >
                      Abrir / editar
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>
        ) : null}

        {tab === 'reportes' ? (
          <section className="becarios-panel">
            <div className="becarios-panel-head">
              <div>
                <span className="becarios-kicker">Exportar</span>
                <h2>Reportes</h2>
                <p className="becarios-date-line">PDF o Excel · día, semana o rango.</p>
              </div>
            </div>
            <div className="becarios-filters">
              <label className="becarios-field">
                Desde
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </label>
              <label className="becarios-field">
                Hasta
                <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </label>
              <button
                type="button"
                className="becarios-btn ghost"
                onClick={() => void cargarHistorial(desde, hasta)}
              >
                Actualizar vista
              </button>
            </div>
            <div className="becarios-export-grid">
              <button type="button" className="becarios-export" onClick={() => descargar('pdf', 'dia')}>
                <FileText size={20} aria-hidden />
                <strong>PDF del día</strong>
                <span>La fecha abierta en Hoy</span>
              </button>
              <button
                type="button"
                className="becarios-export"
                onClick={() => descargar('pdf', 'semana')}
              >
                <Download size={20} aria-hidden />
                <strong>PDF semanal</strong>
                <span>Lunes a domingo de la fecha</span>
              </button>
              <button
                type="button"
                className="becarios-export"
                onClick={() => descargar('pdf', 'rango')}
              >
                <FileText size={20} aria-hidden />
                <strong>PDF por rango</strong>
                <span>Usa Desde / Hasta</span>
              </button>
              <button
                type="button"
                className="becarios-export"
                onClick={() => descargar('xlsx', 'dia')}
              >
                <FileSpreadsheet size={20} aria-hidden />
                <strong>Excel del día</strong>
                <span>Una fila por registro</span>
              </button>
              <button
                type="button"
                className="becarios-export"
                onClick={() => descargar('xlsx', 'semana')}
              >
                <FileSpreadsheet size={20} aria-hidden />
                <strong>Excel semanal</strong>
                <span>Resumen de la semana</span>
              </button>
              <button
                type="button"
                className="becarios-export"
                onClick={() => descargar('xlsx', 'rango')}
              >
                <FileSpreadsheet size={20} aria-hidden />
                <strong>Excel por rango</strong>
                <span>Usa Desde / Hasta</span>
              </button>
            </div>
            <p className="becarios-hint">
              Vista previa del filtro: <strong>{lista.length}</strong> entradas
              {desde && hasta ? ` · ${desde} → ${hasta}` : ''}.
            </p>
          </section>
        ) : null}
      </div>
    </div>
  )
}

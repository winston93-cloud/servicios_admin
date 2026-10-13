'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Copy, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import ThemeToggle from '@/components/ThemeToggle'
import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'
import { etiquetaNivelTe, lunesDe, type TeSnapshot } from '@/lib/teamEnglish/teTypes'
import PlaneacionSeccion from '../components/PlaneacionSeccion'
import CursosSeccion from '../components/CursosSeccion'
import { Avatar, Vacio } from '../components/ui'
import '../team-english.css'

type Tab = 'planeaciones' | 'cursos' | 'resumen'

const TABS: { id: Tab; texto: string }[] = [
  { id: 'planeaciones', texto: '📚 Planeaciones' },
  { id: 'cursos', texto: '🏅 Cursos' },
  { id: 'resumen', texto: '👩‍🏫 Por teacher' },
]

export default function PortalTeachersPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <PortalTeachers />
    </ProtectedRoute>
  )
}

function leerHash(): Tab {
  if (typeof window === 'undefined') return 'planeaciones'
  const h = window.location.hash.replace('#', '')
  return TABS.some((t) => t.id === h) ? (h as Tab) : 'planeaciones'
}

function PortalTeachers() {
  const router = useRouter()
  const [snap, setSnap] = useState<TeSnapshot | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('planeaciones')
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/team-english', { headers: portalSessionFetchHeaders(), cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar el portal de teachers.')
      setSnap(json as TeSnapshot)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
    setTab(leerHash())
  }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = window.setTimeout(() => setAviso(null), aviso.tipo === 'error' ? 6000 : 3500)
    return () => window.clearTimeout(t)
  }, [aviso])

  const avisar = useCallback((texto: string, tipo: 'ok' | 'error' = 'ok') => setAviso({ texto, tipo }), [])

  const abrir = (t: Tab) => {
    setTab(t)
    window.history.replaceState(null, '', `#${t}`)
  }

  const pendientes = useMemo(() => {
    if (!snap) return { planeaciones: 0, cursos: 0 }
    return {
      planeaciones: snap.planeaciones.filter((p) => p.estado === 'pendiente').length,
      cursos: snap.cursos.filter((c) => c.estado === 'pendiente').length,
    }
  }, [snap])

  return (
    <div className="te-page">
      <div className="te-doodles" aria-hidden>
        {['🍎', '✏️', '⭐', '📚', '🌸', '✨', '🏅', '☁️', '💖', '✨'].map((e, i) => (
          <span key={i} style={{ ['--i' as string]: i }}>{e}</span>
        ))}
      </div>
      <div className="te-shell">
        <header className="te-topbar">
          <button type="button" className="te-back" onClick={() => router.push('/dashboard')}>
            <ArrowLeft size={16} aria-hidden /> Dashboard
          </button>
          <div className="te-topbar-der">
            <button type="button" className="te-icon-btn" onClick={() => void cargar()} aria-label="Recargar" disabled={cargando}>
              <RefreshCw size={16} aria-hidden className={cargando ? 'te-spin' : undefined} />
            </button>
            <ThemeToggle />
          </div>
        </header>

        <section className="te-hero">
          <p className="te-kicker">
            <span aria-hidden>🇬🇧</span> English Department{snap ? ` · ${etiquetaNivelTe(snap.nivel)}` : ''}
          </p>
          <h1 className="te-title">
            Portal Teachers <span className="te-title-emoji" aria-hidden>🍎</span>
          </h1>
          <p className="te-lead">Lo que tus teachers suben desde su portal: planeaciones semanales y constancias de cursos, listo para revisar.</p>
        </section>

        <AccesoTeachers avisar={avisar} />

        <div className="te-toasts" aria-live="polite">
          {aviso ? (
            <p className="te-toast" data-tipo={aviso.tipo} role={aviso.tipo === 'error' ? 'alert' : 'status'}>
              <span aria-hidden>{aviso.tipo === 'error' ? '🙈' : '🎉'}</span> {aviso.texto}
              <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso">×</button>
            </p>
          ) : null}
        </div>

        {error ? (
          <div className="te-error-carga" role="alert">
            <span aria-hidden>🥺</span>
            <p>{error}</p>
            <button type="button" className="te-btn te-btn-primary" onClick={() => void cargar()}>Reintentar</button>
          </div>
        ) : cargando && !snap ? (
          <p className="te-cargando"><Loader2 size={20} className="te-spin" aria-hidden /> Cargando a tus teachers…</p>
        ) : snap ? (
          <>
            <div className="te-filtros te-tabs" role="tablist" aria-label="Secciones">
              {TABS.map((t) => {
                const n = t.id === 'planeaciones' ? pendientes.planeaciones : t.id === 'cursos' ? pendientes.cursos : 0
                return (
                  <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} data-activo={tab === t.id || undefined} onClick={() => abrir(t.id)}>
                    {t.texto}
                    {n ? <b title="Por revisar">{n}</b> : null}
                  </button>
                )
              })}
            </div>
            <div className="te-seccion" key={tab}>
              {tab === 'planeaciones' ? <PlaneacionSeccion snap={snap} recargar={cargar} avisar={avisar} /> : null}
              {tab === 'cursos' ? <CursosSeccion snap={snap} recargar={cargar} avisar={avisar} /> : null}
              {tab === 'resumen' ? <Resumen snap={snap} onIr={abrir} /> : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function AccesoTeachers({ avisar }: { avisar: (t: string, tipo?: 'ok' | 'error') => void }) {
  const [url, setUrl] = useState('/team-english/teacher')
  useEffect(() => setUrl(`${window.location.origin}/team-english/teacher`), [])

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url)
      avisar('Enlace copiado. 📋')
    } catch {
      avisar('No se pudo copiar; selecciona el enlace y cópialo a mano.', 'error')
    }
  }
  const mensaje = `Hi, teacher! 🍎 Sube tus planeaciones y las constancias de tus cursos aquí: ${url} (entra con tu mismo usuario y contraseña de boletas).`

  return (
    <aside className="te-acceso" aria-label="Acceso de las teachers">
      <span className="te-acceso-emoji" aria-hidden>🔗</span>
      <div className="te-min0">
        <p className="te-acceso-titulo">Enlace para tus teachers</p>
        <p className="te-acceso-url">{url}</p>
        <small>Entran con su mismo usuario y contraseña de boletas.</small>
      </div>
      <div className="te-fila-botones te-acceso-botones">
        <button type="button" className="te-btn te-btn-sm" onClick={() => void copiar()}><Copy size={14} aria-hidden /> Copiar</button>
        <a className="te-btn te-btn-sm te-btn-ok" href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>
        <a className="te-btn te-btn-ghost te-btn-sm" href="/team-english/teacher" target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden /> Ver portal</a>
      </div>
    </aside>
  )
}

function Resumen({ snap, onIr }: { snap: TeSnapshot; onIr: (t: Tab) => void }) {
  const lunes = lunesDe(snap.hoy)
  const activas = snap.teachers.filter((t) => t.activo)
  if (!activas.length) return <Vacio emoji="👩‍🏫" titulo="Aún no hay teachers en el equipo" />

  const filas = activas.map((t) => {
    const planes = snap.planeaciones.filter((p) => p.maestro_id === t.maestro_id)
    const semana = planes.filter((p) => p.semana === lunes)
    const cursos = snap.cursos.filter((c) => c.maestro_id === t.maestro_id)
    const validados = cursos.filter((c) => c.estado === 'validado')
    return {
      t,
      semana: `${semana.length}/${t.grados.length}`,
      completa: t.grados.length > 0 && semana.length >= t.grados.length,
      aprobadas: planes.filter((p) => p.estado === 'aprobada').length,
      porRevisar: planes.filter((p) => p.estado === 'pendiente').length,
      cursos: validados.length,
      horas: validados.reduce((s, c) => s + (c.horas ?? 0), 0),
      porValidar: cursos.filter((c) => c.estado === 'pendiente').length,
    }
  })

  return (
    <>
      <p className="te-nota te-resumen-nota">Planeaciones del ciclo escolar y cursos subidos por cada teacher. «Esta semana» cuenta los grados con planeación entregada.</p>
      <div className="te-tabla-scroll">
        <table className="te-tabla-exp te-tabla-resumen">
          <thead>
            <tr>
              <th scope="col">Teacher</th>
              <th scope="col">Esta semana</th>
              <th scope="col">Aprobadas</th>
              <th scope="col">Por revisar</th>
              <th scope="col">Cursos validados</th>
              <th scope="col">Horas</th>
              <th scope="col">Por validar</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.t.maestro_id}>
                <td>
                  <span className="te-tabla-nombre">
                    <Avatar emoji={f.t.emoji} fotoKey={f.t.foto_key} nombre={f.t.nombre} tam="sm" /> {f.t.nombre}
                  </span>
                </td>
                <td>{f.completa ? '✅' : '😴'} {f.semana}</td>
                <td>{f.aprobadas}</td>
                <td>{f.porRevisar ? <button type="button" className="te-chip te-chip-btn" onClick={() => onIr('planeaciones')}>⏳ {f.porRevisar}</button> : '—'}</td>
                <td>{f.cursos}</td>
                <td>{f.horas}</td>
                <td>{f.porValidar ? <button type="button" className="te-chip te-chip-btn" onClick={() => onIr('cursos')}>⏳ {f.porValidar}</button> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

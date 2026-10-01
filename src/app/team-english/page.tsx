'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import ThemeToggle from '@/components/ThemeToggle'
import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'
import {
  TE_NIVELES,
  calcularDesempeno,
  etiquetaNivelTe,
  lunesDe,
  type TeNivel,
  type TeSnapshot,
} from '@/lib/teamEnglish/teTypes'
import TeachersSeccion from './components/TeachersSeccion'
import PlaneacionSeccion from './components/PlaneacionSeccion'
import CapacitacionesSeccion from './components/CapacitacionesSeccion'
import DesempenoSeccion from './components/DesempenoSeccion'
import ClassroomSeccion from './components/ClassroomSeccion'
import './team-english.css'

type Seccion = 'teachers' | 'planeacion' | 'capacitaciones' | 'desempeno' | 'classroom'

const SECCIONES: { id: Seccion; titulo: string; emoji: string; sub: string; color: string }[] = [
  { id: 'teachers', titulo: 'Teachers', emoji: '👩‍🏫', sub: 'Perfiles, C.V. e historial', color: 'fresa' },
  { id: 'planeacion', titulo: 'Planeación', emoji: '📚', sub: 'Planes semanales por grado', color: 'lavanda' },
  { id: 'capacitaciones', titulo: 'Capacitaciones', emoji: '🎓', sub: 'Internas y externas', color: 'matcha' },
  { id: 'desempeno', titulo: 'Desempeño', emoji: '⭐', sub: 'Ponderadores y % del equipo', color: 'durazno' },
  { id: 'classroom', titulo: 'Classrooms', emoji: '💻', sub: 'Actualización y revisión', color: 'cielo' },
]

export default function TeamEnglishPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <TeamEnglish />
    </ProtectedRoute>
  )
}

function leerHash(): Seccion | null {
  if (typeof window === 'undefined') return null
  const h = window.location.hash.replace('#', '')
  return SECCIONES.some((s) => s.id === h) ? (h as Seccion) : null
}

function TeamEnglish() {
  const router = useRouter()
  const [nivel, setNivel] = useState<TeNivel | null>(null)
  const [snap, setSnap] = useState<TeSnapshot | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seccion, setSeccion] = useState<Seccion | null>(null)
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null)

  const cargar = useCallback(async (n: TeNivel | null) => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/team-english${n ? `?nivel=${n}` : ''}`, { headers: portalSessionFetchHeaders(), cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar Team English.')
      setSnap(json as TeSnapshot)
      setNivel((json as TeSnapshot).nivel)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    const guardado = Number(window.localStorage.getItem('team-english-nivel')) as TeNivel
    void cargar(guardado === 2 || guardado === 3 ? guardado : null)
    setSeccion(leerHash())
    const onHash = () => setSeccion(leerHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = window.setTimeout(() => setAviso(null), aviso.tipo === 'error' ? 6000 : 3500)
    return () => window.clearTimeout(t)
  }, [aviso])

  const abrir = (s: Seccion | null) => {
    setSeccion(s)
    const url = s ? `#${s}` : window.location.pathname
    window.history.pushState(null, '', url)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cambiarNivel = (n: TeNivel) => {
    window.localStorage.setItem('team-english-nivel', String(n))
    setNivel(n)
    void cargar(n)
  }

  const recargar = useCallback(() => cargar(nivel), [cargar, nivel])
  const avisar = useCallback((texto: string, tipo: 'ok' | 'error' = 'ok') => setAviso({ texto, tipo }), [])

  const resumen = useMemo(() => {
    if (!snap) return null
    const activas = snap.teachers.filter((t) => t.activo)
    const lunes = lunesDe(snap.hoy)
    const mesInicio = `${snap.hoy.slice(0, 8)}01`
    const prom = activas.length
      ? activas.reduce((s, t) => s + calcularDesempeno(t.maestro_id, snap.incidencias, mesInicio, snap.hoy, snap.ponderadores).total, 0) / activas.length
      : 100
    const gruposSemana = activas.reduce((s, t) => s + Math.max(1, t.grupos.length), 0)
    const revisados = snap.classroom.filter(
      (c) => c.semana === lunes && c.actualizado && c.actividades_calificadas && c.trabajos_revisados
    ).length
    return {
      teachers: `${activas.length} teachers · ${activas.filter((t) => t.cv_key).length} con C.V.`,
      planeacion: (() => {
        const p = snap.planeaciones.filter((x) => x.estado === 'pendiente').length
        return p ? `${p} por revisar ⏳` : 'Todo revisado ✨'
      })(),
      capacitaciones: (() => {
        const n = snap.capacitaciones.filter((c) => c.estado === 'programada' && (c.fecha_fin ?? c.fecha_inicio) >= snap.hoy).length
        return n ? `${n} programada${n === 1 ? '' : 's'}` : 'Sin próximas'
      })(),
      desempeno: `Promedio del mes: ${prom.toFixed(1)}%`,
      classroom: `${revisados}/${gruposSemana} grupos al 100% esta semana`,
    } as Record<Seccion, string>
  }, [snap])

  const actual = SECCIONES.find((s) => s.id === seccion)

  return (
    <div className="te-page">
      <div className="te-doodles" aria-hidden>
        {['⭐', '🌸', '☁️', '💖', '✨', '🌈', '🍓', '⭐', '☁️', '✨'].map((e, i) => (
          <span key={i} style={{ ['--i' as string]: i }}>{e}</span>
        ))}
      </div>
      <div className="te-shell">
        <header className="te-topbar">
          <button type="button" className="te-back" onClick={() => (seccion ? abrir(null) : router.push('/dashboard'))}>
            <ArrowLeft size={16} aria-hidden /> {seccion ? 'Team English' : 'Dashboard'}
          </button>
          <div className="te-topbar-der">
            {snap && snap.niveles.length > 1 ? (
              <div className="te-niveles" role="radiogroup" aria-label="Nivel">
                {TE_NIVELES.filter((n) => snap.niveles.includes(n.valor)).map((n) => (
                  <button key={n.valor} type="button" role="radio" aria-checked={nivel === n.valor}
                    data-activo={nivel === n.valor || undefined} onClick={() => cambiarNivel(n.valor)}>
                    <span aria-hidden>{n.emoji}</span> {n.etiqueta}
                  </button>
                ))}
              </div>
            ) : null}
            <button type="button" className="te-icon-btn" onClick={() => void recargar()} aria-label="Recargar" disabled={cargando}>
              <RefreshCw size={16} aria-hidden className={cargando ? 'te-spin' : undefined} />
            </button>
            <ThemeToggle />
          </div>
        </header>

        {!seccion ? (
          <section className="te-hero">
            <p className="te-kicker">
              <span aria-hidden>🇬🇧</span> English Department{snap ? ` · ${etiquetaNivelTe(snap.nivel)}` : ''}
            </p>
            <h1 className="te-title">
              Team English <span className="te-title-emoji" aria-hidden>🌈</span>
            </h1>
            <p className="te-lead">Todo lo de tus teachers en un solo lugar: perfiles, planeaciones, capacitaciones, desempeño y classrooms.</p>
          </section>
        ) : actual ? (
          <section className="te-hero te-hero-seccion" data-color={actual.color}>
            <span className="te-hero-emoji" aria-hidden>{actual.emoji}</span>
            <div className="te-min0">
              <p className="te-kicker">Team English{snap ? ` · ${etiquetaNivelTe(snap.nivel)}` : ''}</p>
              <h1 className="te-title">{actual.titulo}</h1>
            </div>
          </section>
        ) : null}

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
            <button type="button" className="te-btn te-btn-primary" onClick={() => void recargar()}>Reintentar</button>
          </div>
        ) : cargando && !snap ? (
          <p className="te-cargando"><Loader2 size={20} className="te-spin" aria-hidden /> Cargando tu equipo…</p>
        ) : snap ? (
          !seccion ? (
            <nav className="te-hub" aria-label="Módulos de Team English">
              {SECCIONES.map((s, i) => (
                <button key={s.id} type="button" className="te-hub-card" data-color={s.color}
                  style={{ ['--i' as string]: i }} onClick={() => abrir(s.id)}>
                  <span className="te-washi" aria-hidden />
                  <span className="te-hub-emoji" aria-hidden>{s.emoji}</span>
                  <span className="te-hub-titulo">{s.titulo}</span>
                  <span className="te-hub-sub">{s.sub}</span>
                  <span className="te-hub-dato">{resumen?.[s.id]}</span>
                  <span className="te-hub-ir" aria-hidden>→</span>
                </button>
              ))}
            </nav>
          ) : (
            <div className="te-seccion" key={`${seccion}-${snap.nivel}`}>
              {seccion === 'teachers' ? <TeachersSeccion snap={snap} recargar={recargar} avisar={avisar} /> : null}
              {seccion === 'planeacion' ? <PlaneacionSeccion snap={snap} recargar={recargar} avisar={avisar} /> : null}
              {seccion === 'capacitaciones' ? <CapacitacionesSeccion snap={snap} recargar={recargar} avisar={avisar} /> : null}
              {seccion === 'desempeno' ? <DesempenoSeccion snap={snap} recargar={recargar} avisar={avisar} /> : null}
              {seccion === 'classroom' ? <ClassroomSeccion snap={snap} recargar={recargar} avisar={avisar} /> : null}
            </div>
          )
        ) : null}
      </div>
    </div>
  )
}

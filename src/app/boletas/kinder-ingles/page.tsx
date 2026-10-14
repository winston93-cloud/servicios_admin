'use client'

import { ItemAnimado, ListaAnimada, VistaAnimada } from '@/components/boletas-motion'
import ThemeToggle from '@/components/ThemeToggle'
import ProtectedRoute from '@/components/ProtectedRoute'
import RacGoogleSignIn from '@/app/reportes-conducta/components/RacGoogleSignIn'
import {
  KINDER_EN_GRADOS,
  KINDER_EN_GRUPOS,
  KINDER_EN_GRUPOS_MATERNAL,
  etiquetaGrupoKinderEn,
  type KinderEnGrado,
} from '@/lib/boletasKinderEnCatalog'
import { cicloEscolarActualBoletas, etiquetaCicloBoletas, opcionesCicloBoletas } from '@/lib/boletasCiclo'
import {
  ArrowLeft,
  Baby,
  BookOpen,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Inbox,
  LogOut,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import KiCaptura, { type KiCapturaApi, type KiCapturaData, type KiAlumno } from './components/KiCaptura'
import KiCatalogo from './components/KiCatalogo'
import KiEntregas from './components/KiEntregas'
import KiTeachers from './components/KiTeachers'
import { kiApi } from './components/kiApi'
import '../boletas-login-google.css'
import '../boletas-modulos-ui.css'
import './kinder-ingles.css'

type Me = {
  role: 'maestro' | 'admin'
  id: number
  nombre: string
  usuario: string
  cicloActual?: number
  ciclos?: { valor: number; etiqueta: string }[]
}

type Vista = 'menu' | 'captura' | 'entregas' | 'teachers' | 'subject' | 'behavioral' | 'maternal'

const VISTAS: Vista[] = ['menu', 'captura', 'entregas', 'teachers', 'subject', 'behavioral', 'maternal']

const PORTAL_TEACHERS = '/boletas-captura/maternal-kinder'

const MENU: { vista: Exclude<Vista, 'menu'>; titulo: string; desc: string; icon: LucideIcon }[] = [
  {
    vista: 'entregas',
    titulo: 'Entregas y publicación',
    desc: 'Avance por grupo, lo que enviaron las teachers, regresar con comentario y publicar a papás.',
    icon: Inbox,
  },
  {
    vista: 'captura',
    titulo: 'Revisar y corregir',
    desc: 'Abre la boleta de cualquier alumno, corrige y genera el PDF.',
    icon: ClipboardCheck,
  },
  {
    vista: 'teachers',
    titulo: 'Teachers y grupos',
    desc: 'Catálogo de teachers de inglés: alta, edición, baja y grados/grupos asignados.',
    icon: Users,
  },
  {
    vista: 'subject',
    titulo: 'Subjects',
    desc: 'Materias de la boleta por grado (K1, K2, K3) y cuáles cuentan para el Average.',
    icon: BookOpen,
  },
  {
    vista: 'behavioral',
    titulo: 'Behavioral skills',
    desc: 'Habilidades de conducta por grado.',
    icon: Sparkles,
  },
  {
    vista: 'maternal',
    titulo: 'Maternal',
    desc: 'Indicadores de la boleta de Maternal.',
    icon: Baby,
  },
]

const TITULO_VISTA: Record<Vista, string> = {
  menu: 'Kinder · Inglés',
  captura: 'Revisar y corregir',
  entregas: 'Entregas y publicación',
  teachers: 'Teachers y grupos',
  subject: 'Subjects',
  behavioral: 'Behavioral skills',
  maternal: 'Maternal',
}

function vistaDeUrl(): Vista {
  if (typeof window === 'undefined') return 'menu'
  const v = new URLSearchParams(window.location.search).get('vista') as Vista | null
  return v && VISTAS.includes(v) ? v : 'menu'
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
      await kiApi('/api/boletas-secundaria/auth/login', {
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
    <div className="ki-login ki-paper">
      <form onSubmit={submit}>
        <h2>Kinder · Inglés</h2>
        <p>Dirección de inglés. Las teachers capturan en su propio portal.</p>
        <label>
          Usuario
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required />
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
        {error && <p className="ki-msg is-error">{error}</p>}
        <button type="submit" className="ki-btn primary" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <RacGoogleSignIn authUrl="/api/boletas-secundaria/auth/google" onOk={onOk} classPrefix="boletas" />
      <p className="boletas-login-google-hint">
        Google: <strong>englishcoord.educativo@</strong>, <strong>dg@</strong> y <strong>sistemas.desarrollo@</strong>.
      </p>
    </div>
  )
}

function CapturaDirectora({
  ciclo,
  trimestre,
  grado,
  grupo,
}: {
  ciclo: number
  trimestre: number
  grado: KinderEnGrado
  grupo: string
}) {
  const api = useMemo<KiCapturaApi>(
    () => ({
      listar: async () =>
        (
          await kiApi<{ alumnos: KiAlumno[] }>(
            `/api/boletas-kinder-ingles/alumnos?grado=${grado}&grupo=${grupo}&ciclo=${ciclo}&bimestre=${trimestre}`
          )
        ).alumnos,
      abrir: (alumnoId) =>
        kiApi<KiCapturaData>(`/api/boletas-kinder-ingles/captura?alumnoId=${alumnoId}&bimestre=${trimestre}&ciclo=${ciclo}`),
      guardar: async (alumnoId, payload) => {
        await kiApi('/api/boletas-kinder-ingles/captura', {
          method: 'PUT',
          body: JSON.stringify({ alumnoId, bimestre: trimestre, ciclo, ...payload }),
        })
      },
      pdfUrl: (alumnoId) => `/api/boletas-kinder-ingles/pdf?alumnoId=${alumnoId}&bimestre=${trimestre}&ciclo=${ciclo}`,
    }),
    [ciclo, trimestre, grado, grupo]
  )
  return <KiCaptura api={api} claveRecarga={`${ciclo}-${trimestre}-${grado}-${grupo}`} editable />
}

function PortalTeachersCard() {
  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${PORTAL_TEACHERS}`)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2500)
    } catch {
      window.prompt('Copia el enlace del portal de teachers:', `${window.location.origin}${PORTAL_TEACHERS}`)
    }
  }
  return (
    <div className="ki-portal-card">
      <div>
        <strong>Portal de captura para teachers</strong>
        <p className="ki-hint">
          Cada teacher entra con su usuario o su correo institucional, captura sus grupos y te los envía. Tú revisas y
          publicas.
        </p>
      </div>
      <div className="ki-actions">
        <button type="button" className="ki-btn" onClick={() => void copiar()}>
          <Copy size={15} aria-hidden />
          {copiado ? 'Enlace copiado' : 'Copiar enlace'}
        </button>
        <a className="ki-btn ghost" href={PORTAL_TEACHERS} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={15} aria-hidden />
          Abrir
        </a>
      </div>
    </div>
  )
}

function KinderEnApp() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [boot, setBoot] = useState(true)
  const [vista, setVista] = useState<Vista>('menu')
  const [ciclo, setCiclo] = useState(cicloEscolarActualBoletas())
  const [trimestre, setTrimestre] = useState(1)
  const [grado, setGrado] = useState<KinderEnGrado>(1)
  const [grupo, setGrupo] = useState('A')

  const refreshMe = useCallback(async () => {
    try {
      const data = await kiApi<Me>('/api/boletas-secundaria/auth/me')
      setMe(data)
      if (data.cicloActual) setCiclo(data.cicloActual)
    } catch {
      setMe(null)
    } finally {
      setBoot(false)
    }
  }, [])

  useEffect(() => {
    void refreshMe()
    setVista(vistaDeUrl())
    const onPop = () => setVista(vistaDeUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [refreshMe])

  function ir(v: Vista) {
    setVista(v)
    const url = v === 'menu' ? window.location.pathname : `${window.location.pathname}?vista=${v}`
    window.history.pushState(null, '', url)
    window.scrollTo({ top: 0 })
  }

  async function logout() {
    await kiApi('/api/boletas-secundaria/auth/logout', { method: 'POST' }).catch(() => null)
    setMe(null)
  }

  const ciclosOpts = me?.ciclos?.length ? me.ciclos : opcionesCicloBoletas(ciclo)
  const gruposGrado: readonly string[] = grado === 0 ? KINDER_EN_GRUPOS_MATERNAL : KINDER_EN_GRUPOS

  const header = (
    <header className="ki-top bm-top">
      <button
        type="button"
        className="ki-back"
        onClick={() => (me && vista !== 'menu' ? ir('menu') : router.push('/boletas'))}
      >
        <ArrowLeft size={15} aria-hidden />
        {me && vista !== 'menu' ? 'Menú' : 'Boletas'}
      </button>
      <p className="ki-school">Winston Churchill</p>
      <div className="ki-spacer" />
      {me && (
        <>
          <span className="ki-user" title={me.usuario}>
            {me.nombre}
          </span>
          <button type="button" className="ki-btn ghost" onClick={() => void logout()} aria-label="Salir">
            <LogOut size={16} aria-hidden />
          </button>
        </>
      )}
      <ThemeToggle />
    </header>
  )

  if (boot) {
    return (
      <div className="ki-page">
        <p className="ki-boot">Cargando…</p>
      </div>
    )
  }

  if (!me) {
    return (
      <div className="ki-page">
        {header}
        <main className="ki-main">
          <LoginPanel onOk={() => void refreshMe()} />
        </main>
      </div>
    )
  }

  if (me.role !== 'admin') {
    return (
      <div className="ki-page bm-page">
        {header}
        <main className="ki-main">
          <div className="ki-paper bm-panel ki-solo-dir">
            <h2>Este módulo es de la dirección de inglés</h2>
            <p className="ki-hint">Las teachers capturan sus grupos en el portal de captura.</p>
            <a className="ki-btn primary" href={PORTAL_TEACHERS}>
              Ir al portal de teachers
            </a>
          </div>
        </main>
      </div>
    )
  }

  const filtrosPeriodo = (
    <>
      <label>
        Trimestre
        <select value={trimestre} onChange={(e) => setTrimestre(Number(e.target.value))}>
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
      </label>
      <label>
        Ciclo
        <select value={ciclo} onChange={(e) => setCiclo(Number(e.target.value))}>
          {ciclosOpts.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.etiqueta}
            </option>
          ))}
        </select>
      </label>
    </>
  )

  return (
    <div className="ki-page bm-page">
      {header}
      <main className="ki-main">
        <header className="bm-hero">
          <p className="bm-kicker">Sistema integral de boletas · Dirección de inglés</p>
          <h1 className="ki-title">{TITULO_VISTA[vista]}</h1>
          <p className="ki-lead">English Preschool · Ciclo {etiquetaCicloBoletas(ciclo)}</p>
        </header>

        <VistaAnimada vista={vista}>
        {vista === 'menu' && (
          <>
            <h2 className="ki-seccion">Menú de dirección</h2>
            <ListaAnimada className="ki-menu">
              {MENU.map((m) => {
                const Icon = m.icon
                return (
                  <ItemAnimado key={m.vista}>
                    <button type="button" className="ki-menu-item" onClick={() => ir(m.vista)}>
                      <span className="ki-menu-icon" aria-hidden>
                        <Icon size={22} />
                      </span>
                      <span className="ki-menu-text">
                        <strong>{m.titulo}</strong>
                        <span>{m.desc}</span>
                      </span>
                    </button>
                  </ItemAnimado>
                )
              })}
            </ListaAnimada>
            <h2 className="ki-seccion">Portal de captura</h2>
            <PortalTeachersCard />
          </>
        )}

        {vista === 'entregas' && (
          <>
            <div className="ki-paper bm-panel ki-filtros-solos">
              <div className="ki-filters bm-filters">{filtrosPeriodo}</div>
            </div>
            <KiEntregas
              ciclo={ciclo}
              trimestre={trimestre}
              onRevisar={(g, gp) => {
                setGrado(g as KinderEnGrado)
                setGrupo(gp)
                ir('captura')
              }}
            />
          </>
        )}

        {vista === 'captura' && (
          <section className="ki-paper bm-panel">
            <div className="ki-filters bm-filters">
              <label>
                Grado
                <select
                  value={grado}
                  onChange={(e) => {
                    const g = Number(e.target.value) as KinderEnGrado
                    setGrado(g)
                    if (g === 0 && !(KINDER_EN_GRUPOS_MATERNAL as readonly string[]).includes(grupo)) setGrupo('A')
                  }}
                >
                  {KINDER_EN_GRADOS.map((g) => (
                    <option key={g.valor} value={g.valor}>
                      {g.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Grupo
                <select value={grupo} onChange={(e) => setGrupo(e.target.value)}>
                  {gruposGrado.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              {filtrosPeriodo}
            </div>
            <p className="ki-hint ki-captura-nota">
              {etiquetaGrupoKinderEn(grado, grupo)} · Trimestre {trimestre}. Como dirección puedes corregir aunque la
              teacher ya lo haya enviado.
            </p>
            <CapturaDirectora ciclo={ciclo} trimestre={trimestre} grado={grado} grupo={grupo} />
          </section>
        )}

        {vista === 'teachers' && <KiTeachers />}
        {(vista === 'subject' || vista === 'behavioral' || vista === 'maternal') && (
          <KiCatalogo key={vista} tipo={vista} />
        )}
        </VistaAnimada>
      </main>
    </div>
  )
}

export default function BoletasKinderInglesPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <KinderEnApp />
    </ProtectedRoute>
  )
}

'use client'

import ThemeToggle from '@/components/ThemeToggle'
import RacGoogleSignIn from '@/app/reportes-conducta/components/RacGoogleSignIn'
import {
  PRIMARIA_GRADOS,
  PRIMARIA_GRUPOS,
  etiquetaGrupoPrimaria,
  type IdiomaPrimaria,
  type PrimariaGrado,
} from '@/lib/boletasPrimariaCatalog'
import { cicloEscolarActualBoletas, etiquetaCicloBoletas, opcionesCicloBoletas } from '@/lib/boletasCiclo'
import {
  ArrowLeft,
  BookOpen,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Inbox,
  LogOut,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import KiCaptura, { type KiAlumno, type KiCapturaApi, type KiCapturaData } from '../kinder-ingles/components/KiCaptura'
import KiEntregas from '../kinder-ingles/components/KiEntregas'
import KiTeachers from '../kinder-ingles/components/KiTeachers'
import { kiApi } from '../kinder-ingles/components/kiApi'
import PrimariaCatalogo from './PrimariaCatalogo'
import '../boletas-login-google.css'
import '../boletas-modulos-ui.css'
import '../kinder-ingles/kinder-ingles.css'
import './primaria-comun.css'

type Me = {
  role: 'maestro' | 'admin'
  id: number
  nombre: string
  usuario: string
  cicloActual?: number
  ciclos?: { valor: number; etiqueta: string }[]
}

type Vista = 'menu' | 'captura' | 'entregas' | 'docentes' | 'materias'

const VISTAS: Vista[] = ['menu', 'captura', 'entregas', 'docentes', 'materias']

const PORTAL = '/boletas-captura/primaria'

type Textos = {
  api: string
  rutaDocentes: string
  modulo: string
  direccion: string
  docente: 'maestra' | 'teacher'
  docentes: string
  tituloDocentes: string
  tituloMaterias: string
  googleHint: string
}

const TEXTOS: Record<IdiomaPrimaria, Textos> = {
  es: {
    api: '/api/boletas-primaria-espanol',
    rutaDocentes: 'maestras',
    modulo: 'Primaria · Español',
    direccion: 'Dirección de Primaria',
    docente: 'maestra',
    docentes: 'maestras',
    tituloDocentes: 'Maestras y grupos',
    tituloMaterias: 'Materias',
    googleHint: 'direccion.primaria@',
  },
  en: {
    api: '/api/boletas-primaria-ingles',
    rutaDocentes: 'teachers',
    modulo: 'Primaria · Inglés',
    direccion: 'Coordinación de Inglés de Primaria',
    docente: 'teacher',
    docentes: 'teachers',
    tituloDocentes: 'Teachers y grupos',
    tituloMaterias: 'Subjects y skills',
    googleHint: 'coordinacioninglesprimaria@',
  },
}

function vistaDeUrl(): Vista {
  if (typeof window === 'undefined') return 'menu'
  const v = new URLSearchParams(window.location.search).get('vista') as Vista | null
  return v && VISTAS.includes(v) ? v : 'menu'
}

function LoginPanel({ t, onOk }: { t: Textos; onOk: () => void }) {
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
        <h2>{t.modulo}</h2>
        <p>
          {t.direccion}. Las {t.docentes} capturan en su propio portal.
        </p>
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
        Google: <strong>{t.googleHint}</strong>, <strong>dg@</strong> y <strong>sistemas.desarrollo@</strong>.
      </p>
    </div>
  )
}

function CapturaDirectora({
  api: base,
  ciclo,
  trimestre,
  grado,
  grupo,
}: {
  api: string
  ciclo: number
  trimestre: number
  grado: PrimariaGrado
  grupo: string
}) {
  const api = useMemo<KiCapturaApi>(
    () => ({
      listar: async () =>
        (
          await kiApi<{ alumnos: KiAlumno[] }>(
            `${base}/alumnos?grado=${grado}&grupo=${grupo}&ciclo=${ciclo}&bimestre=${trimestre}`
          )
        ).alumnos,
      abrir: (alumnoId) => kiApi<KiCapturaData>(`${base}/captura?alumnoId=${alumnoId}&bimestre=${trimestre}&ciclo=${ciclo}`),
      guardar: async (alumnoId, payload) => {
        await kiApi(`${base}/captura`, {
          method: 'PUT',
          body: JSON.stringify({
            alumnoId,
            bimestre: trimestre,
            ciclo,
            valores: payload.valores,
            attendance: payload.attendance,
          }),
        })
      },
      pdfUrl: (alumnoId) => `${base}/pdf?alumnoId=${alumnoId}&bimestre=${trimestre}&ciclo=${ciclo}`,
    }),
    [base, ciclo, trimestre, grado, grupo]
  )
  return <KiCaptura api={api} claveRecarga={`${ciclo}-${trimestre}-${grado}-${grupo}`} editable />
}

function PortalDocentesCard({ t }: { t: Textos }) {
  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${PORTAL}`)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2500)
    } catch {
      window.prompt('Copia el enlace del portal de captura:', `${window.location.origin}${PORTAL}`)
    }
  }
  return (
    <div className="ki-portal-card">
      <div>
        <strong>Portal de captura para {t.docentes}</strong>
        <p className="ki-hint">
          Cada {t.docente} entra con su usuario o su correo institucional, captura sus grupos y te los envía. Tú revisas
          y publicas. Maestras de español y teachers de inglés usan el mismo portal.
        </p>
      </div>
      <div className="ki-actions">
        <button type="button" className="ki-btn" onClick={() => void copiar()}>
          <Copy size={15} aria-hidden />
          {copiado ? 'Enlace copiado' : 'Copiar enlace'}
        </button>
        <a className="ki-btn ghost" href={PORTAL} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={15} aria-hidden />
          Abrir
        </a>
      </div>
    </div>
  )
}

/** Dirección de Primaria Español o coordinación de Inglés: entregas, revisión, docentes y materias. */
export default function PrimariaDireccion({ idioma }: { idioma: IdiomaPrimaria }) {
  const t = TEXTOS[idioma]
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [boot, setBoot] = useState(true)
  const [vista, setVista] = useState<Vista>('menu')
  const [ciclo, setCiclo] = useState(cicloEscolarActualBoletas())
  const [trimestre, setTrimestre] = useState(1)
  const [grado, setGrado] = useState<PrimariaGrado>(1)
  const [grupo, setGrupo] = useState('A')

  const menu: { vista: Exclude<Vista, 'menu'>; titulo: string; desc: string; icon: LucideIcon }[] = [
    {
      vista: 'entregas',
      titulo: 'Entregas y publicación',
      desc: `Avance por grupo, lo que enviaron las ${t.docentes}, regresar con comentario y publicar a papás.`,
      icon: Inbox,
    },
    {
      vista: 'captura',
      titulo: 'Revisar y corregir',
      desc: 'Abre la boleta de cualquier alumno, corrige y genera el PDF.',
      icon: ClipboardCheck,
    },
    {
      vista: 'docentes',
      titulo: t.tituloDocentes,
      desc: `Catálogo de ${t.docentes}: alta, edición, baja y grados/grupos asignados (1° a 6°).`,
      icon: Users,
    },
    {
      vista: 'materias',
      titulo: t.tituloMaterias,
      desc: 'Lo que se califica en la boleta de cada grado, por sección.',
      icon: BookOpen,
    },
  ]
  const tituloVista: Record<Vista, string> = {
    menu: t.modulo,
    captura: 'Revisar y corregir',
    entregas: 'Entregas y publicación',
    docentes: t.tituloDocentes,
    materias: t.tituloMaterias,
  }

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
          <LoginPanel t={t} onOk={() => void refreshMe()} />
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
            <h2>Este módulo es de la {t.direccion.toLowerCase()}</h2>
            <p className="ki-hint">Las {t.docentes} capturan sus grupos en el portal de captura.</p>
            <a className="ki-btn primary" href={PORTAL}>
              Ir al portal de captura
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
          <p className="bm-kicker">Sistema integral de boletas · {t.direccion}</p>
          <h1 className="ki-title">{tituloVista[vista]}</h1>
          <p className="ki-lead">
            {t.modulo} · Ciclo {etiquetaCicloBoletas(ciclo)}
          </p>
        </header>

        {vista === 'menu' && (
          <>
            <h2 className="ki-seccion">Menú de dirección</h2>
            <ul className="ki-menu">
              {menu.map((m) => {
                const Icon = m.icon
                return (
                  <li key={m.vista}>
                    <button type="button" className="ki-menu-item" onClick={() => ir(m.vista)}>
                      <span className="ki-menu-icon" aria-hidden>
                        <Icon size={22} />
                      </span>
                      <span className="ki-menu-text">
                        <strong>{m.titulo}</strong>
                        <span>{m.desc}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <h2 className="ki-seccion">Portal de captura</h2>
            <PortalDocentesCard t={t} />
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
              apiUrl={`${t.api}/entregas`}
              docente={t.docente}
              onRevisar={(g, gp) => {
                setGrado(g as PrimariaGrado)
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
                <select value={grado} onChange={(e) => setGrado(Number(e.target.value) as PrimariaGrado)}>
                  {PRIMARIA_GRADOS.map((g) => (
                    <option key={g.valor} value={g.valor}>
                      {g.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Grupo
                <select value={grupo} onChange={(e) => setGrupo(e.target.value)}>
                  {PRIMARIA_GRUPOS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              {filtrosPeriodo}
            </div>
            <p className="ki-hint ki-captura-nota">
              {etiquetaGrupoPrimaria(grado, grupo)} · Trimestre {trimestre}. Como dirección puedes corregir aunque la{' '}
              {t.docente} ya lo haya enviado.
            </p>
            <CapturaDirectora api={t.api} ciclo={ciclo} trimestre={trimestre} grado={grado} grupo={grupo} />
          </section>
        )}

        {vista === 'docentes' && (
          <KiTeachers
            apiUrl={`${t.api}/${t.rutaDocentes}`}
            docente={t.docente}
            titulo={idioma === 'es' ? 'Maestras de español' : 'Teachers de inglés'}
            ambito="primaria"
          />
        )}
        {vista === 'materias' && <PrimariaCatalogo idioma={idioma} apiUrl={`${t.api}/catalogo`} />}
      </main>
    </div>
  )
}

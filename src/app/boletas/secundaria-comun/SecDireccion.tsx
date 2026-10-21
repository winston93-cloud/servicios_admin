'use client'

import { ItemAnimado, ListaAnimada, VistaAnimada } from '@/components/boletas-motion'
import MembreteBoleta from '@/app/boletas/components/MembreteBoleta'
import ThemeToggle from '@/components/ThemeToggle'
import RacGoogleSignIn from '@/app/reportes-conducta/components/RacGoogleSignIn'
import { kiApi } from '@/app/boletas/kinder-ingles/components/kiApi'
import { cicloEscolarActualBoletas, etiquetaCicloBoletas, opcionesCicloBoletas } from '@/lib/boletasCiclo'
import { SECUNDARIA_GRADOS, etiquetaGradoSec } from '@/lib/boletasSecundariaCatalog'
import type { SecClase as SecClaseTipo } from '@/lib/boletasSecundariaService'
import { ArrowLeft, BookOpen, ClipboardCheck, Copy, ExternalLink, FileText, Inbox, LogOut, Medal, Users, type LucideIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import SecBoletas from './SecBoletas'
import SecClase, { type SecClaseControl } from './SecClase'
import SecEntregas from './SecEntregas'
import SecPeriodo from './SecPeriodo'
import SecMaestros from './SecMaestros'
import SecMaterias from './SecMaterias'
import SecPromedios from './SecPromedios'
import '../boletas-login-google.css'
import '../boletas-modulos-ui.css'
import '../kinder-ingles/kinder-ingles.css'
import '@/app/boletas-captura/boletas-captura.css'
import './secundaria.css'

type Me = {
  role: 'maestro' | 'admin'
  id: number
  nombre: string
  usuario: string
  cicloActual?: number
  ciclos?: { valor: number; etiqueta: string }[]
}

type Vista = 'menu' | 'entregas' | 'captura' | 'boletas' | 'promedios' | 'maestros' | 'materias'

const VISTAS: Vista[] = ['menu', 'entregas', 'captura', 'boletas', 'promedios', 'maestros', 'materias']

const PORTAL = '/boletas-captura/secundaria'
const API = '/api/boletas-secundaria'

const MENU: { vista: Exclude<Vista, 'menu'>; titulo: string; desc: string; icon: LucideIcon }[] = [
  {
    vista: 'entregas',
    titulo: 'Entregas y publicación',
    desc: 'Por grupo, qué materias ya envió cada maestro; regresar con comentario y publicar a papás.',
    icon: Inbox,
  },
  {
    vista: 'captura',
    titulo: 'Revisar y corregir',
    desc: 'La hoja de cualquier materia y grupo; puedes corregir aunque el maestro ya la haya enviado.',
    icon: ClipboardCheck,
  },
  {
    vista: 'boletas',
    titulo: 'Mostrar Boleta',
    desc: 'Por grado y grupo: la boleta en PDF de cada alumno o la de todo el grupo en un solo archivo.',
    icon: FileText,
  },
  {
    vista: 'promedios',
    titulo: 'Promedios y medallas',
    desc: 'Promedios exactos Winston y SET por grado y grupo, con lugares para la entrega de medallas.',
    icon: Medal,
  },
  {
    vista: 'maestros',
    titulo: 'Maestros y asignaciones',
    desc: 'Alta de maestros y qué materia y grupo da cada uno (lo que ven en su portal).',
    icon: Users,
  },
  {
    vista: 'materias',
    titulo: 'Materias',
    desc: 'Materias de 7°, 8° y 9°: orden en la boleta, SET o Winston y cuáles cuentan en el promedio.',
    icon: BookOpen,
  },
]

const TITULO: Record<Vista, string> = {
  menu: 'Secundaria',
  entregas: 'Entregas y publicación',
  captura: 'Revisar y corregir',
  boletas: 'Mostrar Boleta',
  promedios: 'Promedios y medallas',
  maestros: 'Maestros y asignaciones',
  materias: 'Materias',
}

function vistaDeUrl(): Vista {
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
      await kiApi(`${API}/auth/login`, { method: 'POST', body: JSON.stringify({ usuario, password }) })
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
        <h2>Boletas · Secundaria</h2>
        <p>Dirección de Secundaria. Los maestros capturan en su propio portal.</p>
        <label>
          Usuario
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="ki-msg is-error">{error}</p>}
        <button type="submit" className="ki-btn primary" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <RacGoogleSignIn authUrl={`${API}/auth/google`} onOk={onOk} classPrefix="boletas" />
      <p className="boletas-login-google-hint">
        Google: <strong>direccion.secundaria@</strong>, <strong>asistente.secundaria@</strong>, <strong>dg@</strong> y{' '}
        <strong>sistemas.desarrollo@</strong>.
      </p>
    </div>
  )
}

function PortalCard() {
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
        <strong>Portal de captura para maestros</strong>
        <p className="ki-hint">
          Cada maestro entra con su usuario o correo institucional y ve solo sus materias y grupos, en una hoja tipo Excel. Cuando termina te
          la envía; tú revisas y publicas.
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

function Revisar({
  ciclo,
  trimestre,
  setTrimestre,
  sel,
  setSel,
  controlRef,
}: {
  ciclo: number
  trimestre: number
  setTrimestre: (t: number) => void
  sel: { materiaId: number; grado: number; grupo: string }
  setSel: (s: { materiaId: number; grado: number; grupo: string }) => void
  controlRef: React.RefObject<SecClaseControl | null>
}) {
  const [clases, setClases] = useState<SecClaseTipo[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    kiApi<{ clases: SecClaseTipo[] }>(`${API}/clases?ciclo=${ciclo}`)
      .then((d) => setClases(d.clases))
      .catch((e) => setErr(e instanceof Error ? e.message : 'No se pudieron cargar las clases.'))
  }, [ciclo])

  const lista = clases ?? []
  const grupos = [...new Set(lista.filter((c) => c.grado === sel.grado).map((c) => c.grupo))].sort()
  const materias = lista.filter((c) => c.grado === sel.grado && c.grupo === sel.grupo)
  const actual = materias.find((c) => c.materiaId === sel.materiaId) ?? null

  async function cambiar(s: { materiaId: number; grado: number; grupo: string }) {
    if (controlRef.current && !(await controlRef.current.puedeSalir())) return
    setSel(s)
  }

  return (
    <>
      <section className="ki-paper bm-panel" style={{ marginBottom: '1rem' }}>
        <div className="ki-filters bm-filters">
          <label>
            Grado
            <select
              value={sel.grado}
              onChange={(e) => {
                const g = Number(e.target.value)
                const primera = lista.find((c) => c.grado === g)
                void cambiar({ grado: g, grupo: primera?.grupo ?? 'A', materiaId: primera?.materiaId ?? 0 })
              }}
            >
              {SECUNDARIA_GRADOS.map((g) => (
                <option key={g.valor} value={g.valor}>
                  {g.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label>
            Grupo
            <select value={sel.grupo} onChange={(e) => void cambiar({ ...sel, grupo: e.target.value })}>
              {grupos.map((g) => (
                <option key={g} value={g}>
                  {etiquetaGradoSec(sel.grado)} {g}
                </option>
              ))}
            </select>
          </label>
          <label>
            Materia
            <select value={actual ? sel.materiaId : ''} onChange={(e) => void cambiar({ ...sel, materiaId: Number(e.target.value) })}>
              {!actual && <option value="">Elige la materia…</option>}
              {materias.map((c) => (
                <option key={c.materiaId} value={c.materiaId}>
                  {c.materia}
                  {c.maestros.length ? ` — ${c.maestros.join(', ')}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        {err && <p className="ki-msg is-error">{err}</p>}
      </section>
      {actual && (
        <SecClase
          key={`${actual.materiaId}-${actual.grupo}-${ciclo}`}
          modo="direccion"
          url={`${API}/hoja`}
          extra={{ ciclo }}
          materiaId={actual.materiaId}
          materia={actual.materia}
          grupo={actual.grupo}
          etiqueta={actual.etiqueta}
          maestros={actual.maestros}
          comprension={actual.comprension}
          trimestre={trimestre}
          onTrimestre={setTrimestre}
          hermanas={lista.filter((c) => c.materiaId === actual.materiaId).map((c) => ({ grupo: c.grupo, etiqueta: c.etiqueta }))}
          onGrupo={(g) => setSel({ ...sel, grupo: g })}
          controlRef={controlRef}
        />
      )}
    </>
  )
}

/** Dirección de Secundaria: entregas, revisión, promedios y medallas, maestros y materias. */
export default function SecDireccion() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [boot, setBoot] = useState(true)
  const [vista, setVista] = useState<Vista>('menu')
  const [ciclo, setCiclo] = useState(cicloEscolarActualBoletas())
  const [trimestre, setTrimestre] = useState(1)
  const [sel, setSel] = useState({ materiaId: 0, grado: 1, grupo: 'A' })
  const clase = useRef<SecClaseControl | null>(null)
  const trimestreElegido = useRef(false)
  const preseleccionar = useCallback((t: number) => {
    if (trimestreElegido.current) return
    trimestreElegido.current = true
    setTrimestre(t)
  }, [])

  const refreshMe = useCallback(async () => {
    try {
      const data = await kiApi<Me>(`${API}/auth/me`)
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

  async function ir(v: Vista) {
    if (vista === 'captura' && clase.current && !(await clase.current.puedeSalir())) return
    setVista(v)
    window.history.pushState(null, '', v === 'menu' ? window.location.pathname : `${window.location.pathname}?vista=${v}`)
    window.scrollTo({ top: 0 })
  }

  async function logout() {
    await kiApi(`${API}/auth/logout`, { method: 'POST' }).catch(() => null)
    setMe(null)
  }

  const ciclosOpts = me?.ciclos?.length ? me.ciclos : opcionesCicloBoletas(ciclo)

  const header = (
    <header className="ki-top bm-top">
      <button type="button" className="ki-back" onClick={() => (me && vista !== 'menu' ? void ir('menu') : router.push('/boletas'))}>
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
            <h2>Este módulo es de la Dirección de Secundaria</h2>
            <p className="ki-hint">Los maestros capturan sus materias en el portal de captura.</p>
            <a className="ki-btn primary" href={PORTAL}>
              Ir al portal de captura
            </a>
          </div>
        </main>
      </div>
    )
  }

  const filtros = (
    <div className="ki-paper bm-panel ki-filtros-solos" style={{ marginBottom: '1rem' }}>
      <div className="ki-filters bm-filters">
        {(vista === 'entregas' || vista === 'boletas') && (
          <label>
            {vista === 'boletas' ? 'Boleta hasta el trimestre' : 'Trimestre'}
            <select
              value={trimestre}
              onChange={(e) => {
                trimestreElegido.current = true
                setTrimestre(Number(e.target.value))
              }}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
        )}
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
      </div>
    </div>
  )

  const periodo = <SecPeriodo ciclo={ciclo} esActual={ciclo === (me.cicloActual ?? ciclo)} onAbierto={preseleccionar} />

  return (
    <div className="ki-page bm-page">
      {header}
      <main className="ki-main">
        <MembreteBoleta
          escuela="wci"
          titulo={TITULO[vista]}
          detalle={`Dirección de Secundaria · Ciclo ${etiquetaCicloBoletas(ciclo)}`}
        />

        <VistaAnimada vista={vista}>
        {vista === 'menu' && (
          <>
            {periodo}
            <h2 className="ki-seccion">Menú de dirección</h2>
            <ListaAnimada className="ki-menu">
              {MENU.map((m) => {
                const Icon = m.icon
                return (
                  <ItemAnimado key={m.vista}>
                    <button type="button" className="ki-menu-item" onClick={() => void ir(m.vista)}>
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
            <PortalCard />
          </>
        )}

        {vista === 'entregas' && (
          <>
            {filtros}
            {periodo}
            <SecEntregas
              ciclo={ciclo}
              trimestre={trimestre}
              onRevisar={(materiaId, grado, grupo) => {
                setSel({ materiaId, grado, grupo })
                void ir('captura')
              }}
            />
          </>
        )}

        {vista === 'captura' && (
          <>
            {filtros}
            <Revisar ciclo={ciclo} trimestre={trimestre} setTrimestre={setTrimestre} sel={sel} setSel={setSel} controlRef={clase} />
          </>
        )}

        {vista === 'boletas' && (
          <>
            {filtros}
            <SecBoletas ciclo={ciclo} trimestre={trimestre} />
          </>
        )}

        {vista === 'promedios' && (
          <>
            {filtros}
            <SecPromedios ciclo={ciclo} etiquetaCiclo={etiquetaCicloBoletas(ciclo)} />
          </>
        )}

        {vista === 'maestros' && <SecMaestros />}
        {vista === 'materias' && <SecMaterias />}
        </VistaAnimada>
      </main>
    </div>
  )
}

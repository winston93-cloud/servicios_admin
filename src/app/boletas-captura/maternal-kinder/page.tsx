'use client'

import ThemeToggle from '@/components/ThemeToggle'
import RacGoogleSignIn from '@/app/reportes-conducta/components/RacGoogleSignIn'
import KiCaptura, {
  type KiAlumno,
  type KiCapturaApi,
  type KiCapturaData,
} from '@/app/boletas/kinder-ingles/components/KiCaptura'
import { kiApi } from '@/app/boletas/kinder-ingles/components/kiApi'
import type { BoletaEntrega } from '@/lib/boletasEntrega'
import type { GrupoCaptura, ModuloCapturaKinder } from '@/lib/boletasCapturaGrupos'
import { ArrowLeft, CheckCircle2, LogOut, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import '@/app/boletas/boletas-login-google.css'
import '@/app/boletas/boletas-modulos-ui.css'
import '@/app/boletas/kinder-ingles/kinder-ingles.css'
import '../boletas-captura.css'

const BASE = '/api/boletas-captura/maternal-kinder'

type Sesion = {
  maestro: { id: number; nombre: string; usuario: string }
  supervisor: boolean
  nivel: { slug: string; titulo: string }
  ciclo: { valor: number; etiqueta: string }
  grupos: GrupoCaptura[]
}

type EstadoGrupo = {
  entrega: BoletaEntrega
  publicada: boolean
  editable: boolean
}

const IDIOMAS: Record<ModuloCapturaKinder, { titulo: string; sigla: string; desc: string; docente: string }> = {
  'kinder-es': { titulo: 'Español', sigla: 'ES', desc: 'Maestras · K1 a K3', docente: 'Maestra' },
  'kinder-en': { titulo: 'Inglés', sigla: 'EN', desc: 'Teachers · Maternal y Kinder', docente: 'Teacher' },
}

/** Maternal no lleva boleta de español. */
function capturables(grupos: GrupoCaptura[]): GrupoCaptura[] {
  return grupos.filter((g) => !(g.modulo === 'kinder-es' && g.grado === 0))
}

function claveGrupo(g: GrupoCaptura): string {
  return `${g.modulo}-${g.grado}-${g.grupo}`
}

function fecha(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('es-MX', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'America/Monterrey' })
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
      await kiApi(`${BASE}/auth/login`, { method: 'POST', body: JSON.stringify({ usuario, password }) })
      onOk()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ki-login ki-paper">
      <form onSubmit={submit}>
        <h2>Boletas · Maternal / Kinder</h2>
        <p>Maestras de español y teachers de inglés: entra con tu usuario y contraseña o con tu correo institucional.</p>
        <label>
          Usuario
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
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
        {error && <p className="ki-msg is-error">{error}</p>}
        <button type="submit" className="ki-btn primary" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <RacGoogleSignIn authUrl={`${BASE}/auth/google`} onOk={onOk} classPrefix="boletas" />
    </div>
  )
}

function BannerEstado({ estado, trimestre }: { estado: EstadoGrupo | null; trimestre: number }) {
  if (!estado) return null
  const { entrega, publicada } = estado
  if (publicada) {
    return (
      <div className="bc-banner is-publicada" role="status">
        <CheckCircle2 size={18} aria-hidden />
        <span>Tu directora ya publicó el trimestre {trimestre} a los papás.</span>
      </div>
    )
  }
  if (entrega.estado === 'enviada') {
    return (
      <div className="bc-banner is-enviada" role="status">
        <Send size={18} aria-hidden />
        <span>
          Enviado a dirección {fecha(entrega.enviadaAt) ? `el ${fecha(entrega.enviadaAt)}` : ''}. Ya no se puede editar; si
          hay que corregir algo, tu directora te lo regresa.
        </span>
      </div>
    )
  }
  if (entrega.estado === 'devuelta') {
    return (
      <div className="bc-banner is-devuelta" role="status">
        <span>
          <strong>Tu directora te lo regresó para corregir.</strong>
          {entrega.comentario ? ` «${entrega.comentario}»` : ''} Cuando termines, envíalo otra vez.
        </span>
      </div>
    )
  }
  return null
}

function GrupoTeacher({ grupo, sesion }: { grupo: GrupoCaptura; sesion: Sesion }) {
  const [trimestre, setTrimestre] = useState(1)
  const [estado, setEstado] = useState<EstadoGrupo | null>(null)
  const [alumnos, setAlumnos] = useState<KiAlumno[]>([])
  const [recarga, setRecarga] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const qs = `grado=${grupo.grado}&grupo=${grupo.grupo}&trimestre=${trimestre}`
  const url = `${BASE}/${grupo.modulo}`

  const api = useMemo<KiCapturaApi>(
    () => ({
      listar: async () => {
        const data = await kiApi<EstadoGrupo & { alumnos: KiAlumno[] }>(`${url}?${qs}`)
        setEstado({ entrega: data.entrega, publicada: data.publicada, editable: data.editable })
        return data.alumnos
      },
      abrir: async (alumnoId) => {
        const data = await kiApi<EstadoGrupo & { captura: KiCapturaData }>(`${url}?${qs}&alumnoId=${alumnoId}`)
        setEstado({ entrega: data.entrega, publicada: data.publicada, editable: data.editable })
        return data.captura
      },
      guardar: async (alumnoId, payload) => {
        await kiApi(url, {
          method: 'PUT',
          body: JSON.stringify({ grado: grupo.grado, grupo: grupo.grupo, trimestre, alumnoId, ...payload }),
        })
      },
      pdfUrl: (alumnoId) => `${url}/pdf?${qs}&alumnoId=${alumnoId}`,
    }),
    [url, qs, grupo.grado, grupo.grupo, trimestre]
  )

  async function enviar(forzar = false) {
    if (!forzar && !window.confirm(`¿Enviar ${grupo.etiqueta} (trimestre ${trimestre}) a dirección? Después ya no podrás editar.`)) {
      return
    }
    setEnviando(true)
    setErr('')
    setMsg('')
    try {
      await kiApi(url, {
        method: 'POST',
        body: JSON.stringify({ accion: 'enviar', grado: grupo.grado, grupo: grupo.grupo, trimestre, forzar }),
      })
      setMsg('¡Listo! Tu directora ya puede revisarlo.')
      setRecarga((n) => n + 1)
    } catch (e) {
      const data = (e as { data?: { code?: string; faltan?: string[] } }).data
      if (data?.code === 'incompleto' && data.faltan?.length) {
        const lista = data.faltan.slice(0, 10).join('\n· ')
        const mas = data.faltan.length > 10 ? `\n… y ${data.faltan.length - 10} más` : ''
        setEnviando(false)
        if (
          window.confirm(
            `A ${data.faltan.length} alumno(s) les faltan calificaciones:\n· ${lista}${mas}\n\n¿Enviar de todos modos?`
          )
        ) {
          await enviar(true)
        }
        return
      }
      setErr(e instanceof Error ? e.message : 'No se pudo enviar.')
    } finally {
      setEnviando(false)
    }
  }

  const listos = alumnos.filter((a) => a.progreso && a.progreso.total > 0 && a.progreso.capturadas >= a.progreso.total).length

  return (
    <section className="ki-paper bm-panel">
      <div className="bc-grupo-head">
        <div>
          <p className="bm-kicker">
            {IDIOMAS[grupo.modulo].titulo} · Ciclo {sesion.ciclo.etiqueta}
          </p>
          <h2>{grupo.etiqueta}</h2>
        </div>
        <div className="bc-trimestres" role="tablist" aria-label="Trimestre">
          {[1, 2, 3].map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={trimestre === t}
              className={`ki-tab${trimestre === t ? ' is-on' : ''}`}
              onClick={() => setTrimestre(t)}
            >
              Trimestre {t}
            </button>
          ))}
        </div>
      </div>

      <div className="bc-grupo-estado">
        <BannerEstado estado={estado} trimestre={trimestre} />
        {(msg || err) && (
          <p className={`ki-msg${err ? ' is-error' : ''}`} role={err ? 'alert' : 'status'}>
            {err || msg}
          </p>
        )}
        {estado?.editable && alumnos.length > 0 && (
          <div className="bc-enviar">
            <p className="ki-hint">
              {listos} de {alumnos.length} boletas completas. Guarda cada alumno y, cuando termines, envía el grupo.
            </p>
            <button type="button" className="ki-btn primary" disabled={enviando} onClick={() => void enviar()}>
              <Send size={16} aria-hidden />
              {enviando ? 'Enviando…' : 'Enviar a dirección'}
            </button>
          </div>
        )}
      </div>

      <KiCaptura
        api={api}
        claveRecarga={`${qs}-${recarga}`}
        editable={Boolean(estado?.editable)}
        onCambio={setAlumnos}
        avisoNoEditable={
          estado?.publicada
            ? 'Esta boleta ya está publicada a papás.'
            : 'Ya la enviaste a dirección. Si hay que corregir, tu directora te la regresa.'
        }
      />
    </section>
  )
}

export default function BoletasCapturaMaternalKinderPage() {
  const router = useRouter()
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [boot, setBoot] = useState(true)
  const [errBoot, setErrBoot] = useState('')
  const [idioma, setIdioma] = useState<ModuloCapturaKinder | null>(null)
  const [elegido, setElegido] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setErrBoot('')
    try {
      const s = await kiApi<Sesion>(`${BASE}/sesion`)
      setSesion(s)
      const modulos = [...new Set(capturables(s.grupos).map((g) => g.modulo))]
      if (modulos.length === 1 && !s.supervisor) {
        setIdioma((prev) => prev ?? modulos[0])
        const propios = capturables(s.grupos)
        setElegido((prev) => prev ?? (propios.length === 1 ? claveGrupo(propios[0]) : null))
      }
    } catch (e) {
      setSesion(null)
      if ((e as { status?: number }).status !== 401) {
        setErrBoot(e instanceof Error ? e.message : 'No se pudo cargar.')
      }
    } finally {
      setBoot(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function salir() {
    await kiApi(`${BASE}/auth/logout`, { method: 'POST' }).catch(() => null)
    setSesion(null)
    setIdioma(null)
    setElegido(null)
  }

  const todos = sesion ? capturables(sesion.grupos) : []
  const maternalEs = sesion?.grupos.filter((g) => g.modulo === 'kinder-es' && g.grado === 0) ?? []
  const modulos = (['kinder-es', 'kinder-en'] as const).filter((m) => todos.some((g) => g.modulo === m))
  const eligeIdioma = Boolean(sesion?.supervisor) || modulos.length > 1
  const delIdioma = idioma ? todos.filter((g) => g.modulo === idioma) : []
  const grupo = delIdioma.find((g) => claveGrupo(g) === elegido) ?? null
  const info = idioma ? IDIOMAS[idioma] : null

  function elegirIdioma(m: ModuloCapturaKinder) {
    setIdioma(m)
    const lista = todos.filter((g) => g.modulo === m)
    setElegido(lista.length === 1 && !sesion?.supervisor ? claveGrupo(lista[0]) : null)
  }

  const atras: { label: string; fn: () => void } =
    grupo && delIdioma.length > 1
      ? { label: sesion?.supervisor ? 'Grupos' : 'Mis grupos', fn: () => setElegido(null) }
      : idioma && eligeIdioma
        ? {
            label: 'Español / Inglés',
            fn: () => {
              setIdioma(null)
              setElegido(null)
            },
          }
        : { label: 'Niveles', fn: () => router.push('/boletas-captura') }

  return (
    <div className="ki-page bm-page">
      <header className="ki-top bm-top">
        <button type="button" className="ki-back" onClick={atras.fn}>
          <ArrowLeft size={15} aria-hidden />
          {atras.label}
        </button>
        <p className="ki-school">Winston Churchill</p>
        <div className="ki-spacer" />
        {sesion && (
          <>
            <span className="ki-user" title={sesion.maestro.usuario}>
              {sesion.maestro.nombre}
            </span>
            <button type="button" className="ki-btn ghost" onClick={() => void salir()} aria-label="Salir">
              <LogOut size={16} aria-hidden />
            </button>
          </>
        )}
        <ThemeToggle />
      </header>

      <main className="ki-main">
        {boot ? (
          <p className="ki-boot">Cargando…</p>
        ) : !sesion ? (
          <>
            {errBoot && <p className="ki-msg is-error">{errBoot}</p>}
            <LoginPanel onOk={() => void cargar()} />
          </>
        ) : (
          <>
            <header className="bm-hero">
              <p className="bm-kicker">Captura de boletas · {sesion.nivel.titulo}</p>
              <h1 className="ki-title">Hola, {sesion.maestro.nombre.split(' ')[0]}</h1>
              <p className="ki-lead">Ciclo {sesion.ciclo.etiqueta}</p>
            </header>

            {sesion.supervisor && !grupo && (
              <p className="ki-msg bc-supervision" role="note">
                Modo supervisión: ves todos los grupos del nivel tal como los ve cada maestra o teacher. Lo que guardes
                o envíes a dirección cuenta como captura real.
              </p>
            )}

            {todos.length === 0 && (
              <div className="ki-paper bm-panel bc-vacio">
                <h2>{maternalEs.length ? 'Maternal no lleva boleta de español' : 'Aún no tienes grupos asignados'}</h2>
                <p className="ki-hint">
                  {maternalEs.length
                    ? `Tus grupos (${maternalEs.map((g) => g.etiqueta).join(', ')}) no tienen boleta de español en este portal. Si crees que es un error, avísale a tu directora.`
                    : 'Pide a tu directora que te asigne tu grado y grupo en el catálogo de maestras o de teachers.'}
                </p>
              </div>
            )}

            {eligeIdioma && !idioma && modulos.length > 0 && (
              <>
                <h2 className="bc-pregunta">¿Qué boleta vas a revisar?</h2>
                <ul className="bc-grupos bc-idiomas">
                  {modulos.map((m) => {
                    const n = todos.filter((g) => g.modulo === m).length
                    return (
                      <li key={m}>
                        <button type="button" className="ki-menu-item" onClick={() => elegirIdioma(m)}>
                          <span className="bc-grupo-badge" aria-hidden>
                            {IDIOMAS[m].sigla}
                          </span>
                          <span className="ki-menu-text">
                            <strong>{IDIOMAS[m].titulo}</strong>
                            <span>
                              {IDIOMAS[m].desc} · {n} grupo{n === 1 ? '' : 's'}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}

            {info && !grupo && delIdioma.length > 0 && (
              <ul className="bc-grupos">
                {delIdioma.map((g) => (
                  <li key={claveGrupo(g)}>
                    <button type="button" className="ki-menu-item" onClick={() => setElegido(claveGrupo(g))}>
                      <span className="bc-grupo-badge" aria-hidden>
                        {g.grupo}
                      </span>
                      <span className="ki-menu-text">
                        <strong>{g.etiqueta}</strong>
                        <span>
                          {sesion.supervisor
                            ? `${info.docente}: ${g.teacher || 'sin asignar'}`
                            : `${info.titulo} · capturar boletas`}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {grupo && <GrupoTeacher key={elegido} grupo={grupo} sesion={sesion} />}
          </>
        )}
      </main>
    </div>
  )
}

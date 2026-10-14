'use client'

import ThemeToggle from '@/components/ThemeToggle'
import { kiApi } from '@/app/boletas/kinder-ingles/components/kiApi'
import SecClase, { type SecClaseControl } from '@/app/boletas/secundaria-comun/SecClase'
import { LoginPanel } from '@/app/boletas-captura/PortalCapturaNivel'
import { SECCION_ETIQUETA, SECUNDARIA_GRADOS, etiquetaGradoSec } from '@/lib/boletasSecundariaCatalog'
import type { SecClase as SecClaseTipo } from '@/lib/boletasSecundariaService'
import { ArrowLeft, CheckCircle2, LogOut, Send, Undo2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '@/app/boletas/boletas-login-google.css'
import '@/app/boletas/boletas-modulos-ui.css'
import '@/app/boletas/kinder-ingles/kinder-ingles.css'
import '@/app/boletas/secundaria-comun/secundaria.css'
import '../boletas-captura.css'

const BASE = '/api/boletas-captura/secundaria'
const URL_HOJA = `${BASE}/secundaria`

type EstadoClase = 'captura' | 'enviada' | 'devuelta' | 'publicada'
type Clase = SecClaseTipo & { completos: number; total: number; estado: EstadoClase }

type Sesion = {
  maestro: { id: number; nombre: string; usuario: string }
  supervisor: boolean
  ciclo: { valor: number; etiqueta: string }
}

type Lista = { trimestre: number; supervisor: boolean; clases: Clase[] }

type Sel = { materiaId: number; grupo: string }

function leerUrl(): { sel: Sel | null; trimestre: number } {
  const q = new URLSearchParams(window.location.search)
  const t = Number(q.get('t'))
  const m = Number(q.get('m'))
  const g = q.get('g')
  return {
    trimestre: t >= 1 && t <= 3 ? t : 1,
    sel: m > 0 && g ? { materiaId: m, grupo: g } : null,
  }
}

function escribirUrl(sel: Sel | null, trimestre: number) {
  const q = new URLSearchParams()
  q.set('t', String(trimestre))
  if (sel) {
    q.set('m', String(sel.materiaId))
    q.set('g', sel.grupo)
  }
  window.history.replaceState(null, '', `${window.location.pathname}?${q}`)
}

function EstadoTexto({ c }: { c: Clase }) {
  if (c.estado === 'publicada') {
    return (
      <span className="sp-estado is-publicada">
        <CheckCircle2 size={13} aria-hidden /> Publicada
      </span>
    )
  }
  if (c.estado === 'enviada') {
    return (
      <span className="sp-estado is-enviada">
        <Send size={13} aria-hidden /> Enviada
      </span>
    )
  }
  if (c.estado === 'devuelta') {
    return (
      <span className="sp-estado is-devuelta">
        <Undo2 size={13} aria-hidden /> Regresada
      </span>
    )
  }
  return null
}

function BotonGrupo({ c, titulo, sub, onClick }: { c: Clase; titulo: string; sub?: string; onClick: () => void }) {
  const pct = c.total ? Math.round((c.completos / c.total) * 100) : 0
  return (
    <button type="button" className={`sp-grupo sc-g-${c.grupo}`} onClick={onClick}>
      <strong>{titulo}</strong>
      {sub && <span>{sub}</span>}
      <span>
        {c.completos}/{c.total} completos <EstadoTexto c={c} />
      </span>
      <span className="sp-barra" aria-hidden>
        <i style={{ width: `${pct}%` }} />
      </span>
    </button>
  )
}

/** Portal de maestros de secundaria: cada quien ve sus materias y grupos; la hoja es tipo Excel por materia + grupo. */
export default function PortalSecundariaPage() {
  const router = useRouter()
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [boot, setBoot] = useState(true)
  const [errBoot, setErrBoot] = useState('')
  const [trimestre, setTrimestre] = useState(1)
  const [sel, setSel] = useState<Sel | null>(null)
  const [lista, setLista] = useState<Lista | null>(null)
  const [errLista, setErrLista] = useState('')
  const [grado, setGrado] = useState<number | null>(null)
  const [grupoSup, setGrupoSup] = useState<string | null>(null)
  const clase = useRef<SecClaseControl | null>(null)

  const cargarSesion = useCallback(async () => {
    setErrBoot('')
    try {
      setSesion(await kiApi<Sesion>(`${BASE}/sesion`))
    } catch (e) {
      setSesion(null)
      if ((e as { status?: number }).status !== 401) setErrBoot(e instanceof Error ? e.message : 'No se pudo cargar.')
    } finally {
      setBoot(false)
    }
  }, [])

  useEffect(() => {
    const u = leerUrl()
    setTrimestre(u.trimestre)
    setSel(u.sel)
    void cargarSesion()
  }, [cargarSesion])

  const cargarLista = useCallback(async () => {
    setErrLista('')
    try {
      setLista(await kiApi<Lista>(`${URL_HOJA}?trimestre=${trimestre}`))
    } catch (e) {
      setErrLista(e instanceof Error ? e.message : 'No se pudieron cargar tus materias.')
    }
  }, [trimestre])

  useEffect(() => {
    if (sesion) void cargarLista()
  }, [sesion, cargarLista])

  useEffect(() => {
    if (sesion) escribirUrl(sel, trimestre)
  }, [sesion, sel, trimestre])

  const clases = useMemo(() => lista?.clases ?? [], [lista])
  const actual = sel ? clases.find((c) => c.materiaId === sel.materiaId && c.grupo === sel.grupo) ?? null : null

  const materias = useMemo(() => {
    const out = new Map<number, Clase[]>()
    for (const c of clases) out.set(c.materiaId, [...(out.get(c.materiaId) ?? []), c])
    return [...out.values()]
  }, [clases])

  const gradosSup = SECUNDARIA_GRADOS.filter((g) => clases.some((c) => c.grado === g.valor))
  const gradoSup = grado ?? gradosSup[0]?.valor ?? null
  const gruposSup = [...new Set(clases.filter((c) => c.grado === gradoSup).map((c) => c.grupo))].sort()
  const grupoElegido = grupoSup && gruposSup.includes(grupoSup) ? grupoSup : (gruposSup[0] ?? null)
  const delGrupo = clases.filter((c) => c.grado === gradoSup && c.grupo === grupoElegido)

  async function volver() {
    if (clase.current && !(await clase.current.puedeSalir())) return
    setSel(null)
    void cargarLista()
  }

  async function salir() {
    if (clase.current && !(await clase.current.puedeSalir())) return
    await kiApi(`${BASE}/auth/logout`, { method: 'POST' }).catch(() => null)
    setSesion(null)
    setSel(null)
    setLista(null)
  }

  const supervisor = Boolean(sesion?.supervisor)

  return (
    <div className="ki-page bm-page">
      <header className="ki-top bm-top">
        <button
          type="button"
          className="ki-back"
          onClick={() => (sel && sesion ? void volver() : router.push('/boletas-captura'))}
        >
          <ArrowLeft size={15} aria-hidden />
          {sel && sesion ? (supervisor ? 'Grupos' : 'Mis materias') : 'Niveles'}
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
            <LoginPanel
              base={BASE}
              titulo="Secundaria"
              texto="Maestros de secundaria: entra con tu usuario y contraseña o con tu correo institucional."
              onOk={() => void cargarSesion()}
            />
          </>
        ) : sel ? (
          actual ? (
            <SecClase
              key={`${actual.materiaId}-${actual.grupo}`}
              modo="maestro"
              url={URL_HOJA}
              materiaId={actual.materiaId}
              materia={actual.materia}
              grupo={actual.grupo}
              etiqueta={actual.etiqueta}
              comprension={actual.comprension}
              trimestre={trimestre}
              onTrimestre={setTrimestre}
              hermanas={clases.filter((c) => c.materiaId === actual.materiaId).map((c) => ({ grupo: c.grupo, etiqueta: c.etiqueta }))}
              onGrupo={(g) => setSel({ materiaId: actual.materiaId, grupo: g })}
              controlRef={clase}
              onEnviado={() => void cargarLista()}
            />
          ) : lista ? (
            <div className="ki-paper bm-panel bc-vacio">
              <h2>Esa materia o grupo ya no está asignado a tu usuario</h2>
              <p className="ki-hint">Regresa a tus materias; si falta alguna, pide a tu directora que te la asigne.</p>
              <button type="button" className="ki-btn primary" onClick={() => setSel(null)}>
                Ver mis materias
              </button>
            </div>
          ) : (
            <p className="ki-boot">Cargando…</p>
          )
        ) : (
          <>
            <header className="bm-hero">
              <p className="bm-kicker">Captura de boletas · Secundaria</p>
              <h1 className="ki-title">Hola, {sesion.maestro.nombre.split(' ')[0]}</h1>
              <p className="ki-lead">Ciclo {sesion.ciclo.etiqueta}</p>
            </header>

            {supervisor && (
              <p className="ki-msg bc-supervision" role="note">
                Modo supervisión: eliges grado y grupo y luego la materia. Lo que guardes o envíes cuenta como captura real.
              </p>
            )}

            <div className="sp-trimestre">
              <span>Avance del</span>
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

            {errLista && <p className="ki-msg is-error">{errLista}</p>}
            {!lista && !errLista && <p className="ki-hint">Cargando tus materias…</p>}

            {lista && clases.length === 0 && (
              <div className="ki-paper bm-panel bc-vacio">
                <h2>Aún no tienes materias asignadas</h2>
                <p className="ki-hint">Pide a tu directora que te asigne tus materias y grupos en «Maestros y asignaciones».</p>
              </div>
            )}

            {lista && !supervisor && clases.length > 0 && (
              <>
                <h2 className="ki-seccion">Mis materias</h2>
                <ul className="sp-materias">
                  {materias.map((lst) => (
                    <li key={lst[0].materiaId} className="sp-materia">
                      <div>
                        <h3>{lst[0].materia}</h3>
                        <p className="sp-sub">
                          {etiquetaGradoSec(lst[0].grado)} · {SECCION_ETIQUETA[lst[0].seccion]}
                        </p>
                      </div>
                      <div className="sp-grupos">
                        {lst.map((c) => (
                          <BotonGrupo
                            key={c.grupo}
                            c={c}
                            titulo={c.etiqueta}
                            onClick={() => setSel({ materiaId: c.materiaId, grupo: c.grupo })}
                          />
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {lista && supervisor && clases.length > 0 && (
              <>
                <h2 className="ki-seccion">Grado</h2>
                <div className="sp-selector" role="tablist" aria-label="Grado">
                  {gradosSup.map((g) => (
                    <button
                      key={g.valor}
                      type="button"
                      role="tab"
                      aria-selected={gradoSup === g.valor}
                      className={`ki-tab${gradoSup === g.valor ? ' is-on' : ''}`}
                      onClick={() => {
                        setGrado(g.valor)
                        setGrupoSup(null)
                      }}
                    >
                      {g.etiqueta}
                    </button>
                  ))}
                </div>
                <h2 className="ki-seccion">Grupo</h2>
                <div className="sp-selector" role="tablist" aria-label="Grupo">
                  {gruposSup.map((g) => (
                    <button
                      key={g}
                      type="button"
                      role="tab"
                      aria-selected={grupoElegido === g}
                      className={`sp-grupo sc-g-${g}${grupoElegido === g ? ' is-on' : ''}`}
                      onClick={() => setGrupoSup(g)}
                    >
                      <strong>
                        {etiquetaGradoSec(gradoSup ?? 1)} {g}
                      </strong>
                    </button>
                  ))}
                </div>
                <h2 className="ki-seccion">Materias de {etiquetaGradoSec(gradoSup ?? 1)} {grupoElegido}</h2>
                <ul className="sp-lista">
                  {delGrupo.map((c) => (
                    <li key={c.materiaId}>
                      <BotonGrupo
                        c={c}
                        titulo={c.materia}
                        sub={c.maestros.length ? c.maestros.join(', ') : 'Sin maestro asignado'}
                        onClick={() => setSel({ materiaId: c.materiaId, grupo: c.grupo })}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}

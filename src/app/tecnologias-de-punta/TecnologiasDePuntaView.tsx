'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bricolage_Grotesque } from 'next/font/google'
import {
  ArrowDownWideNarrow,
  ArrowUp,
  ArrowUpNarrowWide,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Plus,
  Search,
  SearchX,
  Trash2,
  X,
} from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { normalizarBusqueda, tokensBusqueda, tramosCoincidencia } from '@/lib/dashboardBusqueda'
import { CATEGORIAS, type CategoriaEnlace, type EnlaceX } from '@/lib/enlacesX/enlacesXTypes'
import { CLAVE_PIN, fetchAdmin } from './adminFetch'
import FormAlta from './FormAlta'
import Panel from './Panel'
import PostEmbebido from './PostEmbebido'
import './tecnologias.css'

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--tp-display' })

const ZONA = 'America/Mexico_City'
const DIAS_NUEVO = 7
const fmtDia = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, day: 'numeric', month: 'short', year: 'numeric' })
const fmtMes = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, month: 'long', year: 'numeric' })
const fmtHora = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, hour: 'numeric', minute: '2-digit' })
const fmtClaveMes = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit' })

const ms = (e: EnlaceX) => new Date(e.fecha).getTime()
const etiquetaCategoria = (c: CategoriaEnlace) => CATEGORIAS.find((x) => x.valor === c)?.etiqueta ?? c
const iniciales = (autor: string) =>
  autor.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function Resaltado({ texto, q }: { texto: string; q: string }) {
  const tramos = tramosCoincidencia(texto, q)
  if (!tramos.length) return <>{texto}</>
  const partes: React.ReactNode[] = []
  let desde = 0
  for (const [ini, fin] of tramos) {
    if (ini > desde) partes.push(texto.slice(desde, ini))
    partes.push(<mark key={ini}>{texto.slice(ini, fin)}</mark>)
    desde = fin
  }
  partes.push(texto.slice(desde))
  return <>{partes}</>
}

function coincide(e: EnlaceX, tokens: string[]) {
  if (!tokens.length) return true
  const pajar = normalizarBusqueda(
    [e.titulo, e.resumen, e.nota, e.autor, e.cuenta, etiquetaCategoria(e.categoria)].filter(Boolean).join(' ')
  )
  return tokens.every((t) => pajar.includes(t))
}

function BotonCopiar({ enlace }: { enlace: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      type="button"
      className="tp-icono-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(enlace)
          setOk(true)
          setTimeout(() => setOk(false), 1600)
        } catch {
          window.prompt('Copia el enlace:', enlace)
        }
      }}
      aria-label={ok ? 'Enlace copiado' : 'Copiar enlace'}
      title={ok ? 'Copiado' : 'Copiar enlace'}
    >
      {ok ? <Check size={18} aria-hidden /> : <Link2 size={18} aria-hidden />}
    </button>
  )
}

type PropsEntrada = {
  e: EnlaceX
  numero: number
  q: string
  nuevo: boolean
  destacado?: boolean
  admin: boolean
  onVer: (e: EnlaceX) => void
  onEliminar: (e: EnlaceX) => Promise<boolean>
}

function Entrada({ e, numero, q, nuevo, destacado = false, admin, onVer, onEliminar }: PropsEntrada) {
  const [confirmar, setConfirmar] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const f = new Date(e.fecha)
  return (
    <article className={`tp-entrada${destacado ? ' tp-entrada--destacada' : ''}`} data-cat={e.categoria}>
      <div className="tp-entrada-meta">
        <span className="tp-num">#{numero}</span>
        <span className="tp-cat">{etiquetaCategoria(e.categoria)}</span>
        {nuevo && <span className="tp-nuevo">Nuevo</span>}
        <time dateTime={e.fecha} className="tp-fecha">
          {fmtDia.format(f)} · {fmtHora.format(f)}
        </time>
      </div>
      <h3 className="tp-titulo">
        <button type="button" onClick={() => onVer(e)}>
          <Resaltado texto={e.titulo} q={q} />
        </button>
      </h3>
      {e.resumen && (
        <p className="tp-resumen">
          <Resaltado texto={e.resumen} q={q} />
        </p>
      )}
      {e.nota && (
        <blockquote className="tp-nota">
          <span className="tp-nota-de">Dirección General</span>
          <Resaltado texto={e.nota} q={q} />
        </blockquote>
      )}
      <footer className="tp-entrada-pie">
        <span className="tp-autor">
          <span className="tp-avatar" aria-hidden>{iniciales(e.autor)}</span>
          <span className="tp-autor-txt">
            <strong><Resaltado texto={e.autor} q={q} /></strong>
            <span>@{e.cuenta}</span>
          </span>
        </span>
        {confirmar ? (
          <span className="tp-confirmar" role="group" aria-label="Confirmar eliminación">
            <span>¿Eliminar esta publicación?</span>
            <button type="button" className="tp-accion tp-accion--sec" onClick={() => setConfirmar(false)} disabled={borrando}>
              Cancelar
            </button>
            <button
              type="button"
              className="tp-accion tp-accion--peligro"
              disabled={borrando}
              onClick={async () => {
                setBorrando(true)
                const ok = await onEliminar(e)
                if (!ok) {
                  setBorrando(false)
                  setConfirmar(false)
                }
              }}
            >
              {borrando ? <Loader2 size={16} className="tp-girar" aria-hidden /> : <Trash2 size={16} aria-hidden />}
              Eliminar
            </button>
          </span>
        ) : (
          <span className="tp-acciones">
            {admin && (
              <button
                type="button"
                className="tp-icono-btn tp-icono-btn--peligro"
                onClick={() => setConfirmar(true)}
                aria-label="Eliminar publicación"
                title="Eliminar"
              >
                <Trash2 size={18} aria-hidden />
              </button>
            )}
            <BotonCopiar enlace={e.enlace} />
            <a
              className="tp-icono-btn"
              href={e.enlace}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir en X (pestaña nueva)"
              title="Abrir en X"
            >
              <ArrowUpRight size={18} aria-hidden />
            </a>
            <button type="button" className="tp-accion" onClick={() => onVer(e)}>
              <Eye size={16} aria-hidden />
              <span>Ver aquí</span>
            </button>
          </span>
        )}
      </footer>
    </article>
  )
}

export default function TecnologiasDePuntaView({ inicial, errorCarga }: { inicial: EnlaceX[]; errorCarga: boolean }) {
  const [enlaces, setEnlaces] = useState<EnlaceX[]>(inicial)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<CategoriaEnlace | 'todas'>('todas')
  const [orden, setOrden] = useState<'recientes' | 'antiguos'>('recientes')
  const [ahora, setAhora] = useState<number | null>(null)
  const [verArriba, setVerArriba] = useState(false)
  const [viendo, setViendo] = useState<EnlaceX | null>(null)
  const [pin, setPin] = useState<string | null>(null)
  const [pidiendoPin, setPidiendoPin] = useState(false)
  const [agregando, setAgregando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const avisar = useCallback((t: string) => {
    setAviso(t)
    setTimeout(() => setAviso((a) => (a === t ? null : a)), 3200)
  }, [])

  useEffect(() => {
    setAhora(Date.now())
    try {
      const guardado = sessionStorage.getItem(CLAVE_PIN)
      if (guardado) setPin(guardado)
    } catch { /* sin sessionStorage */ }
    const onScroll = () => setVerArriba(window.scrollY > 900)
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null
      const escribiendo = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (document.querySelector('.tp-panel-capa')) return
      if ((ev.key === '/' && !escribiendo) || (ev.key.toLowerCase() === 'k' && (ev.metaKey || ev.ctrlKey))) {
        ev.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const tokens = useMemo(() => tokensBusqueda(q), [q])
  const porFecha = useMemo(() => [...enlaces].sort((a, b) => ms(b) - ms(a)), [enlaces])
  const numero = useMemo(() => {
    const m = new Map<number, number>()
    porFecha.forEach((e, i) => m.set(e.id, porFecha.length - i))
    return m
  }, [porFecha])

  const conteos = useMemo(() => {
    const m = new Map<CategoriaEnlace, number>()
    for (const e of enlaces) if (coincide(e, tokens)) m.set(e.categoria, (m.get(e.categoria) ?? 0) + 1)
    return m
  }, [enlaces, tokens])

  const filtrando = tokens.length > 0 || cat !== 'todas'
  const lista = useMemo(() => {
    const r = porFecha.filter((e) => (cat === 'todas' || e.categoria === cat) && coincide(e, tokens))
    return orden === 'recientes' ? r : r.reverse()
  }, [porFecha, cat, tokens, orden])

  const destacado = !filtrando && orden === 'recientes' ? lista[0] : undefined
  const resto = destacado ? lista.slice(1) : lista

  const meses = useMemo(() => {
    const grupos: { clave: string; etiqueta: string; items: EnlaceX[] }[] = []
    for (const e of resto) {
      const f = new Date(e.fecha)
      const clave = fmtClaveMes.format(f)
      let g = grupos[grupos.length - 1]
      if (!g || g.clave !== clave) {
        g = { clave, etiqueta: mayuscula(fmtMes.format(f)), items: [] }
        grupos.push(g)
      }
      g.items.push(e)
    }
    return grupos
  }, [resto])

  const esNuevo = (e: EnlaceX) => ahora != null && ahora - ms(e) < DIAS_NUEVO * 864e5
  const cuentas = new Set(enlaces.map((e) => e.cuenta)).size
  const totalFiltro = [...conteos.values()].reduce((a, b) => a + b, 0)
  const ultimo = porFecha[0]
  const primero = porFecha[porFecha.length - 1]

  const idxViendo = viendo ? lista.findIndex((e) => e.id === viendo.id) : -1
  const irA = useCallback(
    (delta: number) => {
      if (idxViendo < 0) return
      const sig = lista[idxViendo + delta]
      if (sig) setViendo(sig)
    },
    [idxViendo, lista]
  )

  useEffect(() => {
    if (!viendo) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'ArrowRight') irA(1)
      if (ev.key === 'ArrowLeft') irA(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viendo, irA])

  const limpiar = () => {
    setQ('')
    setCat('todas')
  }

  const salirAdmin = useCallback(() => {
    setPin(null)
    setAgregando(false)
    try { sessionStorage.removeItem(CLAVE_PIN) } catch { /* sin sessionStorage */ }
  }, [])

  const pinInvalido = useCallback(() => {
    salirAdmin()
    setPidiendoPin(true)
    avisar('El PIN ya no es válido. Escríbelo de nuevo.')
  }, [salirAdmin, avisar])

  const eliminar = useCallback(
    async (e: EnlaceX) => {
      if (!pin) return false
      const r = await fetchAdmin(`/api/enlaces-x?id=${e.id}`, pin, { method: 'DELETE' })
      if (r.status === 401) {
        pinInvalido()
        return false
      }
      if (!r.ok) {
        avisar(r.error)
        return false
      }
      setEnlaces((xs) => xs.filter((x) => x.id !== e.id))
      if (viendo?.id === e.id) setViendo(null)
      avisar('Publicación eliminada.')
      return true
    },
    [pin, pinInvalido, avisar, viendo]
  )

  return (
    <div className={`tp-page ${display.variable}`}>
      <header className="tp-mast">
        <div className="tp-mast-top">
          <span className="tp-kicker">Instituto Winston Churchill · Desarrollo de Sistemas</span>
          <div className="tp-mast-acciones">
            {pin ? (
              <>
                <button type="button" className="tp-accion" onClick={() => setAgregando(true)}>
                  <Plus size={16} aria-hidden />
                  <span>Agregar</span>
                </button>
                <button type="button" className="tp-icono-btn" onClick={salirAdmin} aria-label="Salir de administración" title="Salir de administración">
                  <LogOut size={18} aria-hidden />
                </button>
              </>
            ) : (
              <button type="button" className="tp-icono-btn" onClick={() => setPidiendoPin(true)} aria-label="Administrar publicaciones" title="Administrar">
                <Lock size={18} aria-hidden />
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
        <h1 className="tp-h1">
          <span className="tp-h1-a">Enlaces de X</span>
          <span className="tp-h1-b">Tecnologías de punta</span>
        </h1>
        <p className="tp-lead">
          Publicaciones sobre inteligencia artificial, agentes y herramientas de desarrollo que Dirección General
          ha compartido con el equipo. Traducidas al español, con la indicación original de cada una.
        </p>
        {ultimo && primero && (
          <dl className="tp-datos">
            <div><dt>Publicaciones</dt><dd>{enlaces.length}</dd></div>
            <div><dt>Cuentas</dt><dd>{cuentas}</dd></div>
            <div><dt>Desde</dt><dd>{fmtDia.format(new Date(primero.fecha))}</dd></div>
            <div><dt>Última</dt><dd>{fmtDia.format(new Date(ultimo.fecha))}</dd></div>
          </dl>
        )}
        {pin && <p className="tp-modo-admin"><Lock size={14} aria-hidden /> Modo administración: puedes agregar y eliminar publicaciones.</p>}
      </header>

      <div className="tp-barra" role="search">
        <div className="tp-barra-in">
          <label className="tp-buscar">
            <Search size={18} aria-hidden />
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(ev) => setQ(ev.target.value)}
              onKeyDown={(ev) => { if (ev.key === 'Escape') setQ('') }}
              placeholder="Buscar: agentes, diseño, Grok, Vercel…"
              aria-label="Buscar publicaciones"
              autoComplete="off"
            />
            {q ? (
              <button type="button" className="tp-buscar-x" onClick={() => setQ('')} aria-label="Limpiar búsqueda">
                <X size={16} aria-hidden />
              </button>
            ) : (
              <kbd className="tp-kbd" aria-hidden>/</kbd>
            )}
          </label>
          <div className="tp-orden" role="group" aria-label="Orden">
            <button type="button" aria-pressed={orden === 'recientes'} onClick={() => setOrden('recientes')}>Recientes</button>
            <button type="button" aria-pressed={orden === 'antiguos'} onClick={() => setOrden('antiguos')}>Antiguos</button>
          </div>
          <button
            type="button"
            className="tp-orden-movil"
            onClick={() => setOrden(orden === 'recientes' ? 'antiguos' : 'recientes')}
            aria-label={orden === 'recientes' ? 'Ver primero los más antiguos' : 'Ver primero los más recientes'}
            title={orden === 'recientes' ? 'Recientes primero' : 'Antiguos primero'}
          >
            {orden === 'recientes' ? <ArrowDownWideNarrow size={20} aria-hidden /> : <ArrowUpNarrowWide size={20} aria-hidden />}
          </button>
        </div>
        <div className="tp-chips" role="group" aria-label="Categorías">
          <button type="button" className="tp-chip" aria-pressed={cat === 'todas'} onClick={() => setCat('todas')}>
            Todo <span>{totalFiltro}</span>
          </button>
          {CATEGORIAS.map((c) => (
            <button
              key={c.valor}
              type="button"
              className="tp-chip"
              data-cat={c.valor}
              aria-pressed={cat === c.valor}
              onClick={() => setCat(cat === c.valor ? 'todas' : c.valor)}
              disabled={!conteos.get(c.valor) && cat !== c.valor}
            >
              <i aria-hidden /> {c.etiqueta} <span>{conteos.get(c.valor) ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <main className="tp-main">
        <p className="tp-estado" aria-live="polite">
          {filtrando
            ? `${lista.length} de ${enlaces.length} publicaciones`
            : `${enlaces.length} publicaciones, ${orden === 'recientes' ? 'de la más reciente a la más antigua' : 'desde la primera'}`}
          {filtrando && (
            <button type="button" className="tp-limpiar" onClick={limpiar}>Quitar filtros</button>
          )}
        </p>

        {destacado && (
          <section className="tp-destacado" aria-label="Lo más reciente">
            <span className="tp-destacado-et">Lo más reciente</span>
            <Entrada
              e={destacado}
              numero={numero.get(destacado.id) ?? 0}
              q={q}
              nuevo={esNuevo(destacado)}
              destacado
              admin={Boolean(pin)}
              onVer={setViendo}
              onEliminar={eliminar}
            />
          </section>
        )}

        {lista.length === 0 ? (
          <div className="tp-vacio">
            <SearchX size={34} aria-hidden />
            {errorCarga ? (
              <>
                <h2>No se pudieron cargar las publicaciones</h2>
                <p>Recarga la página en unos segundos.</p>
              </>
            ) : filtrando ? (
              <>
                <h2>Sin resultados{q ? ` para «${q}»` : ''}</h2>
                <p>Prueba con otra palabra, por ejemplo «agentes», «diseño» o el nombre de una herramienta.</p>
                <button type="button" className="tp-accion" onClick={limpiar}>Ver todas</button>
              </>
            ) : (
              <>
                <h2>Aún no hay publicaciones</h2>
                <p>Entra a administración con el candado y agrega el primer enlace de X.</p>
              </>
            )}
          </div>
        ) : (
          meses.map((g) => (
            <section key={g.clave} className="tp-mes" aria-label={g.etiqueta}>
              <h2 className="tp-mes-h">
                <span>{g.etiqueta}</span>
                <small>{g.items.length} {g.items.length === 1 ? 'publicación' : 'publicaciones'}</small>
              </h2>
              <div className="tp-mes-lista">
                {g.items.map((e) => (
                  <Entrada
                    key={e.id}
                    e={e}
                    numero={numero.get(e.id) ?? 0}
                    q={q}
                    nuevo={esNuevo(e)}
                    admin={Boolean(pin)}
                    onVer={setViendo}
                    onEliminar={eliminar}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      <footer className="tp-pie">
        <span>Curado por Dirección General · Instituto Winston Churchill</span>
        <span>Contenido original en X; resúmenes traducidos al español.</span>
      </footer>

      <button
        type="button"
        className={`tp-arriba${verArriba ? ' tp-arriba--on' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Volver arriba"
        tabIndex={verArriba ? 0 : -1}
      >
        <ArrowUp size={20} aria-hidden />
      </button>

      <Panel
        abierto={viendo !== null}
        onCerrar={() => setViendo(null)}
        ancho="amplio"
        titulo={
          viendo && (
            <span className="tp-visor-cab" data-cat={viendo.categoria}>
              <span className="tp-cat">{etiquetaCategoria(viendo.categoria)}</span>
              <span className="tp-num">#{numero.get(viendo.id)} · {fmtDia.format(new Date(viendo.fecha))}</span>
            </span>
          )
        }
        pie={
          viendo && (
            <>
              <button type="button" className="tp-icono-btn" onClick={() => irA(-1)} disabled={idxViendo <= 0} aria-label="Publicación anterior">
                <ChevronLeft size={20} aria-hidden />
              </button>
              <span className="tp-visor-pos">{idxViendo + 1} de {lista.length}</span>
              <button type="button" className="tp-icono-btn" onClick={() => irA(1)} disabled={idxViendo >= lista.length - 1} aria-label="Publicación siguiente">
                <ChevronRight size={20} aria-hidden />
              </button>
              <a className="tp-accion" href={viendo.enlace} target="_blank" rel="noopener noreferrer">
                Abrir en X <ArrowUpRight size={16} aria-hidden />
              </a>
            </>
          )
        }
      >
        {viendo && (
          <div className="tp-visor" data-cat={viendo.categoria}>
            <h2 className="tp-visor-titulo">{viendo.titulo}</h2>
            {viendo.resumen && <p className="tp-resumen">{viendo.resumen}</p>}
            {viendo.nota && (
              <blockquote className="tp-nota">
                <span className="tp-nota-de">Dirección General</span>
                {viendo.nota}
              </blockquote>
            )}
            <PostEmbebido key={viendo.tweet_id} tweetId={viendo.tweet_id} enlace={viendo.enlace} />
          </div>
        )}
      </Panel>

      <Panel abierto={agregando && pin !== null} onCerrar={() => setAgregando(false)} titulo={<strong>Agregar publicación</strong>}>
        {pin && (
          <FormAlta
            pin={pin}
            onPinInvalido={pinInvalido}
            onGuardado={(nuevo) => {
              setEnlaces((xs) => [nuevo, ...xs.filter((x) => x.id !== nuevo.id)])
              setAgregando(false)
              limpiar()
              setOrden('recientes')
              window.scrollTo({ top: 0, behavior: 'smooth' })
              avisar('Publicación agregada.')
            }}
          />
        )}
      </Panel>

      <PanelPin
        abierto={pidiendoPin}
        onCerrar={() => setPidiendoPin(false)}
        onOk={(p) => {
          setPin(p)
          try { sessionStorage.setItem(CLAVE_PIN, p) } catch { /* sin sessionStorage */ }
          setPidiendoPin(false)
          avisar('Modo administración activado.')
        }}
      />

      <div className={`tp-aviso${aviso ? ' tp-aviso--on' : ''}`} role="status" aria-live="polite">{aviso}</div>
    </div>
  )
}

function PanelPin({ abierto, onCerrar, onOk }: { abierto: boolean; onCerrar: () => void; onOk: (pin: string) => void }) {
  const [valor, setValor] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [validando, setValidando] = useState(false)

  return (
    <Panel abierto={abierto} onCerrar={onCerrar} titulo={<strong>Administrar publicaciones</strong>}>
      <form
        className="tp-form"
        onSubmit={async (e) => {
          e.preventDefault()
          setError(null)
          setValidando(true)
          const r = await fetchAdmin('/api/enlaces-x/pin', valor.trim(), { method: 'POST' })
          setValidando(false)
          if (!r.ok) return setError(r.status === 401 ? 'PIN incorrecto.' : r.error)
          setValor('')
          onOk(valor.trim())
        }}
      >
        <p className="tp-form-ayuda">Escribe el PIN de administración para agregar o eliminar publicaciones.</p>
        <label className="tp-campo">
          <span>PIN</span>
          <input
            className="tp-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            maxLength={12}
            autoFocus
            required
          />
        </label>
        {error && <p className="tp-form-error" role="alert">{error}</p>}
        <button type="submit" className="tp-accion tp-accion--ancha" disabled={validando || !valor.trim()}>
          {validando && <Loader2 size={16} className="tp-girar" aria-hidden />}
          Entrar
        </button>
      </form>
    </Panel>
  )
}

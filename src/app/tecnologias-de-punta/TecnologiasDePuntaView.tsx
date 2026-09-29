'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Bricolage_Grotesque } from 'next/font/google'
import {
  ArrowDownWideNarrow,
  ArrowUp,
  ArrowUpNarrowWide,
  ArrowUpRight,
  Check,
  Link2,
  Search,
  SearchX,
  X,
} from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { normalizarBusqueda, tokensBusqueda, tramosCoincidencia } from '@/lib/dashboardBusqueda'
import { CATEGORIAS, ENLACES_X, type CategoriaEnlace, type EnlaceX } from './enlacesX'
import './tecnologias.css'

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--tp-display' })

const DIAS_NUEVO = 7
const fmtDia = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtMes = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' })
const fmtHora = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit' })

const aFecha = (s: string) => new Date(`${s}:00`)
const etiquetaCategoria = (c: CategoriaEnlace) => CATEGORIAS.find((x) => x.valor === c)?.etiqueta ?? c
const iniciales = (autor: string) =>
  autor.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')

/** Número fijo por antigüedad: #1 es el primero que se compartió. */
const NUMERO = new Map([...ENLACES_X].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((e, i) => [e.id, i + 1]))

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
      className="tp-accion tp-accion--sec"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(enlace)
          setOk(true)
          setTimeout(() => setOk(false), 1600)
        } catch {
          window.prompt('Copia el enlace:', enlace)
        }
      }}
      aria-label="Copiar enlace"
    >
      {ok ? <Check size={16} aria-hidden /> : <Link2 size={16} aria-hidden />}
      <span>{ok ? 'Copiado' : 'Copiar'}</span>
    </button>
  )
}

function Entrada({ e, q, nuevo, destacado = false }: { e: EnlaceX; q: string; nuevo: boolean; destacado?: boolean }) {
  const f = aFecha(e.fecha)
  return (
    <article className={`tp-entrada${destacado ? ' tp-entrada--destacada' : ''}`} data-cat={e.categoria}>
      <div className="tp-entrada-meta">
        <span className="tp-num">#{NUMERO.get(e.id)}</span>
        <span className="tp-cat">{etiquetaCategoria(e.categoria)}</span>
        {nuevo && <span className="tp-nuevo">Nuevo</span>}
        <time dateTime={e.fecha} className="tp-fecha">
          {fmtDia.format(f)} · {fmtHora.format(f)}
        </time>
      </div>
      <h3 className="tp-titulo">
        <a href={e.enlace} target="_blank" rel="noopener noreferrer">
          <Resaltado texto={e.titulo} q={q} />
        </a>
      </h3>
      <p className="tp-resumen">
        <Resaltado texto={e.resumen} q={q} />
      </p>
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
        <span className="tp-acciones">
          <BotonCopiar enlace={e.enlace} />
          <a className="tp-accion" href={e.enlace} target="_blank" rel="noopener noreferrer">
            <span>Abrir en X</span>
            <ArrowUpRight size={16} aria-hidden />
          </a>
        </span>
      </footer>
    </article>
  )
}

export default function TecnologiasDePuntaView() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<CategoriaEnlace | 'todas'>('todas')
  const [orden, setOrden] = useState<'recientes' | 'antiguos'>('recientes')
  const [ahora, setAhora] = useState<number | null>(null)
  const [verArriba, setVerArriba] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setAhora(Date.now())
    const onScroll = () => setVerArriba(window.scrollY > 900)
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null
      const escribiendo = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
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
  const porFecha = useMemo(() => [...ENLACES_X].sort((a, b) => b.fecha.localeCompare(a.fecha)), [])
  const ultimo = porFecha[0]!
  const primero = porFecha[porFecha.length - 1]!

  const conteos = useMemo(() => {
    const m = new Map<CategoriaEnlace, number>()
    for (const e of ENLACES_X) if (coincide(e, tokens)) m.set(e.categoria, (m.get(e.categoria) ?? 0) + 1)
    return m
  }, [tokens])

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
      const clave = e.fecha.slice(0, 7)
      let g = grupos[grupos.length - 1]
      if (!g || g.clave !== clave) {
        const mes = fmtMes.format(aFecha(e.fecha))
        g = { clave, etiqueta: mes.charAt(0).toUpperCase() + mes.slice(1), items: [] }
        grupos.push(g)
      }
      g.items.push(e)
    }
    return grupos
  }, [resto])

  const esNuevo = (e: EnlaceX) => ahora != null && ahora - aFecha(e.fecha).getTime() < DIAS_NUEVO * 864e5
  const cuentas = new Set(ENLACES_X.map((e) => e.cuenta)).size
  const totalFiltro = [...conteos.values()].reduce((a, b) => a + b, 0)

  const limpiar = () => {
    setQ('')
    setCat('todas')
  }

  return (
    <div className={`tp-page ${display.variable}`}>
      <header className="tp-mast">
        <div className="tp-mast-top">
          <span className="tp-kicker">Instituto Winston Churchill · Desarrollo de Sistemas</span>
          <ThemeToggle />
        </div>
        <h1 className="tp-h1">
          <span className="tp-h1-a">Enlaces de X</span>
          <span className="tp-h1-b">Tecnologías de punta</span>
        </h1>
        <p className="tp-lead">
          Publicaciones sobre inteligencia artificial, agentes y herramientas de desarrollo que Dirección General
          ha compartido con el equipo. Traducidas al español, con la indicación original de cada una.
        </p>
        <dl className="tp-datos">
          <div><dt>Publicaciones</dt><dd>{ENLACES_X.length}</dd></div>
          <div><dt>Cuentas</dt><dd>{cuentas}</dd></div>
          <div><dt>Desde</dt><dd>{fmtDia.format(aFecha(primero.fecha))}</dd></div>
          <div><dt>Última</dt><dd>{fmtDia.format(aFecha(ultimo.fecha))}</dd></div>
        </dl>
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
            ? `${lista.length} de ${ENLACES_X.length} publicaciones`
            : `${ENLACES_X.length} publicaciones, ${orden === 'recientes' ? 'de la más reciente a la más antigua' : 'desde la primera'}`}
          {filtrando && (
            <button type="button" className="tp-limpiar" onClick={limpiar}>Quitar filtros</button>
          )}
        </p>

        {destacado && (
          <section className="tp-destacado" aria-label="Lo más reciente">
            <span className="tp-destacado-et">Lo más reciente</span>
            <Entrada e={destacado} q={q} nuevo={esNuevo(destacado)} destacado />
          </section>
        )}

        {lista.length === 0 ? (
          <div className="tp-vacio">
            <SearchX size={34} aria-hidden />
            <h2>Sin resultados para «{q}»</h2>
            <p>Prueba con otra palabra, por ejemplo «agentes», «diseño» o el nombre de una herramienta.</p>
            <button type="button" className="tp-accion" onClick={limpiar}>Ver todas</button>
          </div>
        ) : (
          meses.map((g) => (
            <section key={g.clave} className="tp-mes" aria-label={g.etiqueta}>
              <h2 className="tp-mes-h">
                <span>{g.etiqueta}</span>
                <small>{g.items.length} {g.items.length === 1 ? 'publicación' : 'publicaciones'}</small>
              </h2>
              <div className="tp-mes-lista">
                {g.items.map((e) => <Entrada key={e.id} e={e} q={q} nuevo={esNuevo(e)} />)}
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
    </div>
  )
}

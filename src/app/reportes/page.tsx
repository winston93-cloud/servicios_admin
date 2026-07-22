'use client'

import ThemeToggle from '@/components/ThemeToggle'
import ProtectedRoute from '@/components/ProtectedRoute'
import { CicloEscolarProvider, useCicloEscolar } from '@/contexts/CicloEscolarContext'
import {
  getCiclosEscolaresOpcionesDesdeBase,
  toCicloEscolar,
  type CicloEscolar,
} from '@/lib/ciclosEscolares'
import {
  REPORTE_CATEGORIAS,
  REPORTE_ENTRADAS,
  apiPathReporte,
  type NivelId,
  type ReporteCatalogEntry,
} from '@/lib/reportesCatalogData'
import { cicloSugeridoParaReporte, etiquetaCicloReporte } from '@/lib/reportesConfig'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Award,
  ChevronDown,
  Fingerprint,
  LayoutGrid,
  RefreshCw,
  Search,
  UserMinus,
  UserPlus,
  Users,
  Sparkles,
  Star,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ReporteParametros from './ReporteParametros'
import ReporteTile from './ReporteTile'

type ParametrosReporte = {
  nivel: NivelId
  ciclo: number
}

const CAT_ICONS: Record<string, LucideIcon> = {
  'mis-reportes': Star,
  'reportes-especiales': Sparkles,
  deudores: Wallet,
  'nuevo-ingreso': UserPlus,
  curp: Fingerprint,
  listas: Users,
  reinscritos: RefreshCw,
  becados: Award,
  bajas: UserMinus,
  otros: LayoutGrid,
}

function catsAbiertasIniciales(): Record<string, boolean> {
  return Object.fromEntries(REPORTE_CATEGORIAS.map((c) => [c.id, true]))
}

function buildUrls(
  entry: ReporteCatalogEntry,
  params: ParametrosReporte,
  origin: string
): { ver: string; pdf?: string; copy: string; verLabel: string; pdfLabel: string; disponible: boolean } {
  const apiPath = apiPathReporte(entry)
  if (!apiPath) {
    return { ver: '#', copy: '', verLabel: 'Ver', pdfLabel: 'PDF', disponible: false }
  }

  const qs = new URLSearchParams({ ciclo: String(params.ciclo) })
  if (entry.requiereNivel) qs.set('nivel', params.nivel)

  const html = `${apiPath}?${qs.toString()}`
  const pdf = `${apiPath}?${qs.toString()}&format=pdf`
  const base = origin || ''

  return {
    ver: `${base}${html}`,
    pdf: `${base}${pdf}`,
    copy: `${base}${pdf}`,
    verLabel: 'Ver',
    pdfLabel: 'PDF',
    disponible: true,
  }
}

function metaReporte(entry: ReporteCatalogEntry, params: ParametrosReporte): string {
  const parts = ['HTML/PDF nativo']
  if (entry.requiereNivel) {
    const n = params.nivel.charAt(0).toUpperCase() + params.nivel.slice(1)
    parts.push(n)
  }
  if (entry.usaCiclo) {
    parts.push(etiquetaCicloReporte(entry.usaCiclo, params.ciclo))
  }
  if (entry.cicloSistema) {
    parts.push('temporada actual')
  }
  return parts.join(' · ')
}

function ReportesPageInner() {
  const router = useRouter()
  const {
    ciclos,
    cicloActualSistema,
    cicloInscripcionSistema,
    etiquetaCicloActualSistema,
    etiquetaCicloInscripcionSistema,
    opcionesCatalogo,
    cargando: cargandoCiclos,
  } = useCicloEscolar()

  const [copiado, setCopiado] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [paramsById, setParamsById] = useState<Record<string, ParametrosReporte>>({})
  const [catsAbiertas, setCatsAbiertas] = useState<Record<string, boolean>>(catsAbiertasIniciales)

  const ciclosOpciones = useMemo((): CicloEscolar[] => {
    if (opcionesCatalogo.length > 0) {
      return opcionesCatalogo.map((o) => ({
        ...toCicloEscolar(o.valor),
        etiqueta: o.etiqueta || toCicloEscolar(o.valor).etiqueta,
      }))
    }
    return getCiclosEscolaresOpcionesDesdeBase(cicloActualSistema)
  }, [opcionesCatalogo, cicloActualSistema])

  /** Nuevo ingreso: solo ciclo vigente (`es_actual`) y activos hacia adelante. */
  const ciclosOpcionesNuevoIngreso = useMemo((): CicloEscolar[] => {
    const adelante = ciclos
      .filter((c) => c.activo && c.valor >= cicloActualSistema)
      .sort((a, b) => a.valor - b.valor)
    const lista =
      adelante.length > 0
        ? adelante
        : ciclos.filter((c) => c.es_actual || c.valor === cicloActualSistema)
    if (lista.length === 0) {
      return [
        {
          ...toCicloEscolar(cicloActualSistema),
          etiqueta: etiquetaCicloActualSistema || toCicloEscolar(cicloActualSistema).etiqueta,
        },
      ]
    }
    return lista.map((c) => ({
      ...toCicloEscolar(c.valor),
      etiqueta: c.nombre || toCicloEscolar(c.valor).etiqueta,
    }))
  }, [ciclos, cicloActualSistema, etiquetaCicloActualSistema])

  const paramsIniciales = useCallback(
    (entry: ReporteCatalogEntry): ParametrosReporte => {
      let ciclo = entry.cicloSistema
        ? entry.usaCiclo === 'inscripcion'
          ? cicloInscripcionSistema
          : cicloActualSistema
        : cicloSugeridoParaReporte(entry.usaCiclo, cicloActualSistema)

      // Doble titulación: el ciclo vigente suele ir vacío; sugerir el anterior (pagos históricos).
      if (entry.id === 'doble-titulacion') {
        ciclo = Math.max(1, cicloActualSistema - 1)
      }

      // Becas: tras el avance de temporada las becas activas suelen seguir en el
      // ciclo anterior (ej. fichas 23, beca_ciclo 22) hasta que se renueven.
      if (entry.id === 'becados' || entry.id === 'becados-sexto') {
        ciclo = Math.max(1, cicloActualSistema - 1)
      }

      // Bajas: las del año que acaba de cerrar quedan en el ciclo anterior;
      // el vigente arranca casi vacío (salvo secundarias recientes).
      if (entry.id === 'bajas') {
        ciclo = Math.max(1, cicloActualSistema - 1)
      }

      // Nuevo ingreso: temporada vigente; el select solo ofrece vigente + activos adelante.
      if (entry.categoriaId === 'nuevo-ingreso') {
        ciclo = cicloActualSistema
      }

      return { nivel: 'primaria', ciclo }
    },
    [cicloActualSistema, cicloInscripcionSistema]
  )

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin)
  }, [])

  // Al cargar / cambiar temporada (`es_actual`), reiniciar defaults de cada tile.
  useEffect(() => {
    if (cargandoCiclos) return
    const initial: Record<string, ParametrosReporte> = {}
    for (const entry of REPORTE_ENTRADAS) {
      initial[entry.id] = paramsIniciales(entry)
    }
    setParamsById(initial)
  }, [cargandoCiclos, paramsIniciales])

  const getParams = useCallback(
    (entry: ReporteCatalogEntry): ParametrosReporte => {
      return paramsById[entry.id] ?? paramsIniciales(entry)
    },
    [paramsById, paramsIniciales]
  )

  const setParam = useCallback(
    (id: string, patch: Partial<ParametrosReporte>) => {
      setParamsById((prev) => {
        const entry = REPORTE_ENTRADAS.find((e) => e.id === id)!
        return {
          ...prev,
          [id]: { ...(prev[id] ?? paramsIniciales(entry)), ...patch },
        }
      })
    },
    [paramsIniciales]
  )

  const copiarUrl = useCallback(async (id: string, url: string) => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(id)
      window.setTimeout(() => setCopiado(null), 2000)
    } catch {
      setCopiado(null)
    }
  }, [])

  const q = busqueda.trim().toLowerCase()
  const entradasFiltradas = useMemo(() => {
    if (!q) return REPORTE_ENTRADAS
    return REPORTE_ENTRADAS.filter((item) => {
      const cat = REPORTE_CATEGORIAS.find((c) => c.id === item.categoriaId)
      const blob = [item.titulo, item.descripcion, cat?.titulo ?? '', ...item.keywords]
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [q])

  const categoriasVisibles = useMemo(() => {
    const ids = new Set(entradasFiltradas.map((e) => e.categoriaId))
    return REPORTE_CATEGORIAS.filter((c) => ids.has(c.id)).sort((a, b) => a.orden - b.orden)
  }, [entradasFiltradas])

  useEffect(() => {
    if (!q) return
    setCatsAbiertas((prev) => {
      const next = { ...prev }
      for (const cat of categoriasVisibles) {
        next[cat.id] = true
      }
      return next
    })
  }, [q, categoriasVisibles])

  const toggleCategoria = useCallback((catId: string) => {
    setCatsAbiertas((prev) => ({ ...prev, [catId]: !prev[catId] }))
  }, [])

  const renderTile = (entry: ReporteCatalogEntry) => {
    const params = getParams(entry)
    const urls = buildUrls(entry, params, origin)
    const mostrarCiclo = Boolean(entry.usaCiclo) && !entry.cicloSistema
    const cicloLabel = entry.usaCiclo === 'inscripcion' ? 'Ciclo inscripción' : 'Ciclo'

    return (
      <ReporteTile
        key={entry.id}
        id={entry.id}
        titulo={entry.titulo}
        meta={metaReporte(entry, params)}
        descripcion={entry.descripcion}
        accent={entry.accent}
        motor={entry.motor}
        icon={null}
        verHref={urls.ver}
        verLabel={urls.verLabel}
        descargarHref={urls.disponible ? urls.pdf : undefined}
        descargarLabel={urls.pdfLabel}
        copyUrl={urls.copy}
        copiado={copiado}
        onCopy={copiarUrl}
        deshabilitado={!urls.disponible}
        defaultExpanded={
          entry.categoriaId === 'mis-reportes' ||
          entry.categoriaId === 'reportes-especiales' ||
          entry.categoriaId === 'deudores' ||
          entry.categoriaId === 'nuevo-ingreso' ||
          Boolean(q)
        }
        extra={
          entry.requiereNivel || mostrarCiclo ? (
            <ReporteParametros
              nivel={params.nivel}
              onNivelChange={(n) => setParam(entry.id, { nivel: n })}
              mostrarNivel={Boolean(entry.requiereNivel)}
              ciclo={params.ciclo}
              onCicloChange={(c) => setParam(entry.id, { ciclo: c })}
              mostrarCiclo={mostrarCiclo}
              cicloLabel={cicloLabel}
              ciclosOpciones={
                entry.categoriaId === 'nuevo-ingreso'
                  ? ciclosOpcionesNuevoIngreso
                  : ciclosOpciones
              }
            />
          ) : null
        }
      />
    )
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-main reportes-page">
        <div className="reportes-hero">
          <div className="reportes-hero-glow" aria-hidden />
          <div className="dashboard-heading reportes-heading">
            <button
              type="button"
              className="servicios-back-btn"
              onClick={() => router.push('/dashboard')}
            >
              <ArrowLeft size={16} aria-hidden />
              Volver al inicio
            </button>
            <p className="reportes-eyebrow">Instituto Winston Churchill</p>
            <h1 className="dashboard-title">Reportes</h1>
            <p className="dashboard-subtitle">
              Ciclo escolar {etiquetaCicloActualSistema}
              {cargandoCiclos ? '' : ` (${cicloActualSistema})`} · inscripción{' '}
              {etiquetaCicloInscripcionSistema}
              {cargandoCiclos ? '' : ` (${cicloInscripcionSistema})`}
            </p>
            <p className="reportes-legacy-hint">
              Temporada según el ciclo marcado como actual en el catálogo. Inscripción =
              siguiente (origen→origen+1). Cada reporte lleva su propio select de ciclo.
            </p>
            <div className="reportes-hero-bar" aria-hidden />
            <div className="reportes-theme-row">
              <ThemeToggle />
            </div>
          </div>
        </div>

        <div className="reportes-toolbar">
          <label className="reportes-search">
            <Search size={20} aria-hidden />
            <input
              type="search"
              placeholder="Buscar reporte…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </label>
          <span className="reportes-count">
            {entradasFiltradas.length} de {REPORTE_ENTRADAS.length}
          </span>
        </div>

        {entradasFiltradas.length === 0 ? (
          <p className="reportes-empty">No hay reportes que coincidan con la búsqueda.</p>
        ) : (
          <div className="reportes-categories">
            {categoriasVisibles.map((cat) => {
              const items = entradasFiltradas.filter((e) => e.categoriaId === cat.id)
              if (!items.length) return null
              const abierta = Boolean(catsAbiertas[cat.id])
              const panelId = `reportes-cat-${cat.id}`
              const Icon = CAT_ICONS[cat.id] ?? LayoutGrid
              return (
                <section
                  key={cat.id}
                  className={`reportes-section reportes-section--${cat.id}${
                    items.length > 3 ? ' reportes-section--wide' : ''
                  }${abierta ? ' reportes-section--open' : ' reportes-section--collapsed'}`}
                  data-cat={cat.id}
                >
                  <header className="reportes-section-head">
                    <button
                      type="button"
                      className="reportes-section-toggle"
                      aria-expanded={abierta}
                      aria-controls={panelId}
                      onClick={() => toggleCategoria(cat.id)}
                    >
                      <span className="reportes-section-icon" aria-hidden>
                        <Icon size={16} />
                      </span>
                      <ChevronDown
                        className={`reportes-section-chevron${abierta ? ' reportes-section-chevron--open' : ''}`}
                        size={16}
                        aria-hidden
                      />
                      <div className="reportes-section-head-text">
                        <h2 className="reportes-section-title">{cat.titulo}</h2>
                        {abierta && cat.subtitulo ? (
                          <p className="reportes-section-sub">{cat.subtitulo}</p>
                        ) : null}
                      </div>
                    </button>
                    <span className="reportes-section-count">{items.length}</span>
                  </header>
                  {abierta ? (
                    <div className="reportes-cat-grid" id={panelId}>
                      {items.map(renderTile)}
                    </div>
                  ) : null}
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReportesPage() {
  return (
    <ProtectedRoute>
      <CicloEscolarProvider>
        <ReportesPageInner />
      </CicloEscolarProvider>
    </ProtectedRoute>
  )
}

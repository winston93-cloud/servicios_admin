'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import {
  cicloEscolarEtiqueta,
  getCicloEscolarActual,
  getCicloInscripcion,
  getCiclosEscolaresOpciones,
} from '@/lib/ciclosEscolares'
import {
  REPORTE_CATEGORIAS,
  REPORTE_ENTRADAS,
  resolveLegacyFile,
  type NivelId,
  type ReporteCatalogEntry,
} from '@/lib/reportesCatalogData'
import {
  reporteAlumnosCicloPdfPath,
  reporteLegacyUrl,
} from '@/lib/reportesConfig'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ReporteParametros from './ReporteParametros'
import ReporteTile from './ReporteTile'

type ParametrosReporte = {
  nivel: NivelId
  ciclo: number
}

function paramsIniciales(entry: ReporteCatalogEntry): ParametrosReporte {
  const ciclo =
    entry.usaCiclo === 'inscripcion'
      ? getCicloInscripcion()
      : getCicloEscolarActual()
  return { nivel: 'primaria', ciclo }
}

function buildUrls(
  entry: ReporteCatalogEntry,
  params: ParametrosReporte,
  origin: string
): { ver: string; pdf?: string; copy: string; verLabel: string; pdfLabel: string } {
  if (entry.motor === 'legacy-php') {
    const file = entry.requiereNivel
      ? resolveLegacyFile(entry, params.nivel)
      : resolveLegacyFile(entry, params.nivel)
    if (!file) {
      return { ver: '#', copy: '', verLabel: 'Ver', pdfLabel: 'PDF' }
    }
    const url = reporteLegacyUrl(file)
    return {
      ver: url,
      copy: url,
      verLabel: 'Abrir PDF',
      pdfLabel: 'PDF',
    }
  }

  if (entry.motor === 'api-next' && entry.apiPath) {
    const html = `${entry.apiPath}?ciclo=${params.ciclo}`
    const pdf = `${entry.apiPath}?ciclo=${params.ciclo}&format=pdf`
    const base = origin || ''
    return {
      ver: `${base}${html}`,
      pdf: `${base}${pdf}`,
      copy: `${base}${pdf}`,
      verLabel: 'Ver',
      pdfLabel: 'PDF',
    }
  }

  if (entry.motor === 'static-pdf') {
    const path =
      entry.id === 'alumnos-ciclo-pdf'
        ? reporteAlumnosCicloPdfPath(params.ciclo)
        : entry.staticPath ?? '#'
    const url = origin ? `${origin}${path}` : path
    return {
      ver: url,
      pdf: url,
      copy: url,
      verLabel: 'Ver PDF',
      pdfLabel: 'PDF',
    }
  }

  return { ver: '#', copy: '', verLabel: 'Ver', pdfLabel: 'PDF' }
}

function metaReporte(entry: ReporteCatalogEntry, params: ParametrosReporte): string {
  if (entry.motor === 'legacy-php') {
    const parts = ['PDF legacy']
    if (entry.requiereNivel) {
      const n = params.nivel.charAt(0).toUpperCase() + params.nivel.slice(1)
      parts.push(n)
    }
    if (entry.usaCiclo) {
      parts.push(
        entry.usaCiclo === 'inscripcion'
          ? `insc. ${cicloEscolarEtiqueta(params.ciclo)}`
          : cicloEscolarEtiqueta(params.ciclo)
      )
    }
    return parts.join(' · ')
  }
  if (entry.motor === 'api-next') {
    return `HTML/PDF · ciclo ${params.ciclo}`
  }
  return `PDF · ciclo ${params.ciclo}`
}

export default function ReportesPage() {
  const router = useRouter()
  const [copiado, setCopiado] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [paramsById, setParamsById] = useState<Record<string, ParametrosReporte>>({})

  const cicloActual = useMemo(() => getCicloEscolarActual(), [])
  const cicloInscripcion = useMemo(() => getCicloInscripcion(), [])
  const ciclosOpciones = useMemo(() => getCiclosEscolaresOpciones(), [])

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    const initial: Record<string, ParametrosReporte> = {}
    for (const entry of REPORTE_ENTRADAS) {
      initial[entry.id] = paramsIniciales(entry)
    }
    setParamsById(initial)
  }, [])

  const getParams = useCallback(
    (entry: ReporteCatalogEntry): ParametrosReporte => {
      return paramsById[entry.id] ?? paramsIniciales(entry)
    },
    [paramsById]
  )

  const setParam = useCallback(
    (id: string, patch: Partial<ParametrosReporte>) => {
      setParamsById((prev) => ({
        ...prev,
        [id]: { ...(prev[id] ?? paramsIniciales(REPORTE_ENTRADAS.find((e) => e.id === id)!)), ...patch },
      }))
    },
    []
  )

  const copiarUrl = useCallback(async (id: string, url: string) => {
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
      const blob = [
        item.titulo,
        item.descripcion,
        cat?.titulo ?? '',
        ...item.keywords,
      ]
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [q])

  const categoriasVisibles = useMemo(() => {
    const ids = new Set(entradasFiltradas.map((e) => e.categoriaId))
    return REPORTE_CATEGORIAS.filter((c) => ids.has(c.id)).sort(
      (a, b) => a.orden - b.orden
    )
  }, [entradasFiltradas])

  return (
    <ProtectedRoute>
      <div className="dashboard-container">
        <div className="dashboard-main reportes-page">
          <div className="dashboard-heading reportes-heading">
            <button
              type="button"
              className="servicios-back-btn"
              onClick={() => router.push('/dashboard')}
            >
              <ArrowLeft size={16} aria-hidden />
              Volver al inicio
            </button>
            <h1 className="dashboard-title">Reportes</h1>
            <p className="dashboard-subtitle">
              Ciclo escolar {cicloEscolarEtiqueta(cicloActual)} · inscripción{' '}
              {cicloEscolarEtiqueta(cicloInscripcion)}
            </p>
            <p className="reportes-legacy-hint">
              Los reportes legacy abren el PDF en{' '}
              <strong>winston93.edu.mx/reportes</strong> (sesión PHP). Los nativos
              se generan aquí con el ciclo que elijas.
            </p>
          </div>

          <div className="reportes-toolbar">
            <label className="reportes-search">
              <Search size={15} aria-hidden />
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
            categoriasVisibles.map((cat) => {
              const items = entradasFiltradas.filter((e) => e.categoriaId === cat.id)
              if (!items.length) return null
              return (
                <section key={cat.id} className="reportes-section">
                  <header className="reportes-section-head">
                    <div className="reportes-section-head-text">
                      <h2 className="reportes-section-title">{cat.titulo}</h2>
                      {cat.subtitulo ? (
                        <p className="reportes-section-sub">{cat.subtitulo}</p>
                      ) : null}
                    </div>
                    <span className="reportes-section-count">{items.length}</span>
                  </header>
                  <div className="reportes-grid">
                    {items.map((entry) => {
                      const params = getParams(entry)
                      const urls = buildUrls(entry, params, origin)
                      const mostrarCiclo =
                        entry.motor !== 'legacy-php' && Boolean(entry.usaCiclo)
                      const cicloLabel =
                        entry.usaCiclo === 'inscripcion' ? 'Ciclo inscripción' : 'Ciclo'

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
                          descargarHref={urls.pdf}
                          descargarLabel={urls.pdfLabel}
                          copyUrl={urls.copy}
                          copiado={copiado}
                          onCopy={copiarUrl}
                          extra={
                            entry.requiereNivel || mostrarCiclo ? (
                              <ReporteParametros
                                nivel={params.nivel}
                                onNivelChange={(n) => setParam(entry.id, { nivel: n })}
                                mostrarNivel={entry.requiereNivel}
                                ciclo={params.ciclo}
                                onCicloChange={(c) => setParam(entry.id, { ciclo: c })}
                                mostrarCiclo={mostrarCiclo}
                                cicloLabel={cicloLabel}
                                ciclosOpciones={ciclosOpciones}
                              />
                            ) : entry.usaCiclo && entry.motor === 'legacy-php' ? (
                              <p className="reporte-tile-legacy-ciclo">
                                Referencia:{' '}
                                {entry.usaCiclo === 'inscripcion'
                                  ? `inscripción ${cicloEscolarEtiqueta(cicloInscripcion)}`
                                  : `ciclo ${cicloEscolarEtiqueta(cicloActual)}`}
                                {' '}
                                (automático en servidor PHP)
                              </p>
                            ) : null
                          }
                        />
                      )
                    })}
                  </div>
                </section>
              )
            })
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

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
  apiPathReporte,
  type NivelId,
  type ReporteCatalogEntry,
} from '@/lib/reportesCatalogData'
import { etiquetaCicloReporte } from '@/lib/reportesConfig'
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
  return parts.join(' · ')
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
    const base = !q
      ? REPORTE_ENTRADAS
      : REPORTE_ENTRADAS.filter((item) => {
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

    const ordenCategoria = new Map(
      REPORTE_CATEGORIAS.map((c) => [c.id, c.orden] as const)
    )
    return [...base].sort(
      (a, b) =>
        (ordenCategoria.get(a.categoriaId) ?? 99) -
          (ordenCategoria.get(b.categoriaId) ?? 99) ||
        a.titulo.localeCompare(b.titulo, 'es')
    )
  }, [q])

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
              Los reportes se generan en Servicios Admin (InsForge + Vercel). Elige
              nivel y ciclo; no dependen del hosting PHP legacy.
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
            <div className="reportes-mosaic">
              {entradasFiltradas.map((entry) => {
                const params = getParams(entry)
                const urls = buildUrls(entry, params, origin)
                const mostrarCiclo = Boolean(entry.usaCiclo)
                const cicloLabel =
                  entry.usaCiclo === 'inscripcion' ? 'Ciclo inscripción' : 'Ciclo'
                const categoria = REPORTE_CATEGORIAS.find((c) => c.id === entry.categoriaId)

                return (
                  <ReporteTile
                    key={entry.id}
                    id={entry.id}
                    titulo={entry.titulo}
                    meta={[categoria?.titulo, metaReporte(entry, params)].filter(Boolean).join(' · ')}
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
                      ) : entry.usaCiclo ? (
                        <ReporteParametros
                          nivel={params.nivel}
                          onNivelChange={() => {}}
                          mostrarNivel={false}
                          ciclo={params.ciclo}
                          onCicloChange={(c) => setParam(entry.id, { ciclo: c })}
                          mostrarCiclo
                          cicloLabel={cicloLabel}
                          ciclosOpciones={ciclosOpciones}
                        />
                      ) : null
                    }
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

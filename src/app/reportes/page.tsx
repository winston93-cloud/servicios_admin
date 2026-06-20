'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import {
  REPORTE_ALUMNOS_CICLO_23_PATH,
  REPORTE_BECADOS_CICLO_DEFAULT,
  reporteAlumnosCiclo23Url,
  reporteBecadosUrl,
} from '@/lib/reportesConfig'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import ReporteTile from './ReporteTile'
import { REPORTES_CATALOGO } from './reportesCatalog'

export default function ReportesPage() {
  const router = useRouter()
  const [copiado, setCopiado] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [cicloBecados, setCicloBecados] = useState(String(REPORTE_BECADOS_CICLO_DEFAULT))

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin)
  }, [])

  const cicloBecadosNum = useMemo(() => {
    const n = parseInt(cicloBecados, 10)
    return Number.isInteger(n) && n > 0 ? n : REPORTE_BECADOS_CICLO_DEFAULT
  }, [cicloBecados])

  const becadosHtmlPath = `/api/reportes/becados?ciclo=${cicloBecadosNum}`
  const becadosPdfPath = `/api/reportes/becados?ciclo=${cicloBecadosNum}&format=pdf`
  const becadosPdfUrl = origin ? `${origin}${becadosPdfPath}` : reporteBecadosUrl(cicloBecadosNum, 'pdf')
  const alumnosPdfUrl = origin ? `${origin}${REPORTE_ALUMNOS_CICLO_23_PATH}` : reporteAlumnosCiclo23Url()

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
  const catalogoFiltrado = useMemo(() => {
    if (!q) return REPORTES_CATALOGO
    return REPORTES_CATALOGO.filter((item) => {
      const blob = [item.titulo, item.meta, item.descripcion, ...item.keywords]
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
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
              Consulta y descarga de reportes administrativos
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
              {catalogoFiltrado.length} de {REPORTES_CATALOGO.length}
            </span>
          </div>

          {catalogoFiltrado.length === 0 ? (
            <p className="reportes-empty">No hay reportes que coincidan con la búsqueda.</p>
          ) : (
            <div className="reportes-grid">
              {catalogoFiltrado.map((item) => {
                if (item.id === 'alumnos-ciclo-23') {
                  return (
                    <ReporteTile
                      key={item.id}
                      id={item.id}
                      titulo={item.titulo}
                      meta={item.meta}
                      descripcion={item.descripcion}
                      accent={item.accent}
                      icon={item.icon}
                      verHref={REPORTE_ALUMNOS_CICLO_23_PATH}
                      descargarHref={REPORTE_ALUMNOS_CICLO_23_PATH}
                      copyUrl={alumnosPdfUrl}
                      copiado={copiado}
                      onCopy={copiarUrl}
                    />
                  )
                }

                if (item.id === 'becados') {
                  return (
                    <ReporteTile
                      key={item.id}
                      id={item.id}
                      titulo={item.titulo}
                      meta={item.meta}
                      descripcion={item.descripcion}
                      accent={item.accent}
                      icon={item.icon}
                      verHref={becadosHtmlPath}
                      descargarHref={becadosPdfPath}
                      copyUrl={becadosPdfUrl}
                      copiado={copiado}
                      onCopy={copiarUrl}
                      extra={
                        <label className="reporte-tile-ciclo">
                          <span>Ciclo</span>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={cicloBecados}
                            onChange={(e) => setCicloBecados(e.target.value)}
                            inputMode="numeric"
                          />
                        </label>
                      }
                    />
                  )
                }

                return null
              })}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}

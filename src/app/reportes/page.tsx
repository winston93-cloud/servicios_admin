'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import {
  REPORTE_ALUMNOS_CICLO_23_PATH,
  REPORTE_BECADOS_CICLO_DEFAULT,
  reporteAlumnosCiclo23Url,
  reporteBecadosUrl,
} from '@/lib/reportesConfig'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Copy, Download, ExternalLink, FileText, GraduationCap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

export default function ReportesPage() {
  const router = useRouter()
  const [copiado, setCopiado] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')
  const [cicloBecados, setCicloBecados] = useState(String(REPORTE_BECADOS_CICLO_DEFAULT))

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

  const cicloBecadosNum = useMemo(() => {
    const n = parseInt(cicloBecados, 10)
    return Number.isInteger(n) && n > 0 ? n : REPORTE_BECADOS_CICLO_DEFAULT
  }, [cicloBecados])

  const becadosHtmlPath = `/api/reportes/becados?ciclo=${cicloBecadosNum}`
  const becadosPdfPath = `/api/reportes/becados?ciclo=${cicloBecadosNum}&format=pdf`
  const becadosHtmlUrl = origin ? `${origin}${becadosHtmlPath}` : reporteBecadosUrl(cicloBecadosNum, 'html')
  const becadosPdfUrl = origin ? `${origin}${becadosPdfPath}` : reporteBecadosUrl(cicloBecadosNum, 'pdf')

  const alumnosPdfUrl = origin
    ? `${origin}${REPORTE_ALUMNOS_CICLO_23_PATH}`
    : reporteAlumnosCiclo23Url()

  const copiarUrl = useCallback(async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(id)
      window.setTimeout(() => setCopiado(null), 2000)
    } catch {
      setCopiado(null)
    }
  }, [])

  return (
    <ProtectedRoute>
      <div className="dashboard-container">
        <div className="dashboard-main">
          <div className="dashboard-heading">
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

          <div className="reportes-grid">
            <article className="reporte-card reporte-card--violet">
              <div className="reporte-card-icon" aria-hidden>
                <FileText size={22} />
              </div>
              <div className="reporte-card-body">
                <p className="reporte-card-meta">79 alumnos · 4 niveles · PDF</p>
                <h2 className="reporte-card-title">Alumnos Ciclo Escolar 23</h2>
                <p className="reporte-card-desc">
                  Listado por nivel y grado con nombre completo, grupo y estatus.
                </p>
                <code className="reporte-card-url">{alumnosPdfUrl}</code>
                <div className="reporte-card-actions">
                  <a
                    className="reporte-btn reporte-btn--primary"
                    href={REPORTE_ALUMNOS_CICLO_23_PATH}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={16} aria-hidden />
                    Ver PDF
                  </a>
                  <a
                    className="reporte-btn"
                    href={REPORTE_ALUMNOS_CICLO_23_PATH}
                    download="alumnos-ciclo-23.pdf"
                  >
                    <Download size={16} aria-hidden />
                    Descargar
                  </a>
                  <button
                    type="button"
                    className="reporte-btn"
                    onClick={() => copiarUrl('alumnos-ciclo-23', alumnosPdfUrl)}
                  >
                    <Copy size={16} aria-hidden />
                    {copiado === 'alumnos-ciclo-23' ? 'Copiado' : 'Copiar URL'}
                  </button>
                </div>
              </div>
            </article>

            <article className="reporte-card reporte-card--amber">
              <div className="reporte-card-icon reporte-card-icon--amber" aria-hidden>
                <GraduationCap size={22} />
              </div>
              <div className="reporte-card-body">
                <p className="reporte-card-meta">Becas activas · por ciclo · PDF/HTML</p>
                <h2 className="reporte-card-title">Alumnos becados</h2>
                <p className="reporte-card-desc">
                  Listado de alumnos con beca activa en{' '}
                  <code>alumno_beca</code>, enlazado con <code>alumno</code> por nivel y grado.
                </p>
                <label className="reporte-ciclo-field">
                  <span>Ciclo escolar</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={cicloBecados}
                    onChange={(e) => setCicloBecados(e.target.value)}
                    inputMode="numeric"
                  />
                </label>
                <code className="reporte-card-url">{becadosPdfUrl}</code>
                <div className="reporte-card-actions">
                  <a
                    className="reporte-btn reporte-btn--amber"
                    href={becadosHtmlPath}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={16} aria-hidden />
                    Ver reporte
                  </a>
                  <a
                    className="reporte-btn"
                    href={becadosPdfPath}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download size={16} aria-hidden />
                    Descargar PDF
                  </a>
                  <button
                    type="button"
                    className="reporte-btn"
                    onClick={() => copiarUrl('becados', becadosPdfUrl)}
                  >
                    <Copy size={16} aria-hidden />
                    {copiado === 'becados' ? 'Copiado' : 'Copiar URL'}
                  </button>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

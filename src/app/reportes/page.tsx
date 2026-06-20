'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import {
  REPORTE_ALUMNOS_CICLO_23_PATH,
  reporteAlumnosCiclo23Url,
} from '@/lib/reportesConfig'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Copy, Download, ExternalLink, FileText } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const REPORTES = [
  {
    id: 'alumnos-ciclo-23',
    titulo: 'Alumnos Ciclo Escolar 23',
    descripcion:
      'Listado por nivel y grado con nombre completo, grupo y estatus. Exportado desde Winston Servicios.',
    path: REPORTE_ALUMNOS_CICLO_23_PATH,
    meta: '79 alumnos · 4 niveles · PDF',
    accent: 'violet' as const,
  },
]

export default function ReportesPage() {
  const router = useRouter()
  const [copiado, setCopiado] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState(reporteAlumnosCiclo23Url())

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPdfUrl(`${window.location.origin}${REPORTE_ALUMNOS_CICLO_23_PATH}`)
    }
  }, [])

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
            {REPORTES.map((reporte) => {
              const url =
                reporte.id === 'alumnos-ciclo-23'
                  ? pdfUrl
                  : `${typeof window !== 'undefined' ? window.location.origin : ''}${reporte.path}`

              return (
                <article
                  key={reporte.id}
                  className={`reporte-card reporte-card--${reporte.accent}`}
                >
                  <div className="reporte-card-icon" aria-hidden>
                    <FileText size={22} />
                  </div>
                  <div className="reporte-card-body">
                    <p className="reporte-card-meta">{reporte.meta}</p>
                    <h2 className="reporte-card-title">{reporte.titulo}</h2>
                    <p className="reporte-card-desc">{reporte.descripcion}</p>
                    <code className="reporte-card-url">{url}</code>
                    <div className="reporte-card-actions">
                      <a
                        className="reporte-btn reporte-btn--primary"
                        href={reporte.path}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink size={16} aria-hidden />
                        Ver PDF
                      </a>
                      <a
                        className="reporte-btn"
                        href={reporte.path}
                        download="alumnos-ciclo-23.pdf"
                      >
                        <Download size={16} aria-hidden />
                        Descargar
                      </a>
                      <button
                        type="button"
                        className="reporte-btn"
                        onClick={() => copiarUrl(reporte.id, url)}
                      >
                        <Copy size={16} aria-hidden />
                        {copiado === reporte.id ? 'Copiado' : 'Copiar URL'}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

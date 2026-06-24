'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import { urlCfdiLegacyApp, urlReporteContadoresLegacy } from '@/lib/cfdiConfig'
import { FACTURACION_NAV } from '@/lib/facturacionNav'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import FacturacionNavIcon from './FacturacionNavIcon'

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

type FacturacionShellProps = {
  title?: string
  subtitle?: string
  children: React.ReactNode
  showNav?: boolean
}

export default function FacturacionShell({
  title = 'Facturación CFDI',
  subtitle = 'Timbrado, cancelaciones y devoluciones — Instituto Winston Churchill',
  children,
  showNav = true,
}: FacturacionShellProps) {
  const router = useRouter()
  const legacy = urlCfdiLegacyApp()
  const reporteXml = urlReporteContadoresLegacy()

  return (
    <ProtectedRoute>
      <div className="dashboard-container facturacion-cfdi-page">
        <div className="dashboard-home-bg" aria-hidden="true" />
        <div className="dashboard-main">
          <div className="dashboard-heading reportes-heading facturacion-cfdi-heading">
            <button
              type="button"
              className="servicios-back-btn"
              onClick={() => router.push('/dashboard')}
            >
              <ArrowLeft size={16} aria-hidden />
              Volver al inicio
            </button>
            <h1 className="dashboard-title">{title}</h1>
            <p className="dashboard-subtitle">{subtitle}</p>
            <p className="facturacion-cfdi-legacy-hint">
              Portal PHP sigue en producción hasta nuevo aviso:{' '}
              <a href={legacy} target="_blank" rel="noopener noreferrer">
                cfdiwinston <ExternalLink size={12} className="inline-icon" aria-hidden />
              </a>
              {' · '}
              <a href={reporteXml} target="_blank" rel="noopener noreferrer">
                Reporte contadores <ExternalLink size={12} className="inline-icon" aria-hidden />
              </a>
            </p>
          </div>

          {showNav ? (
            <div className="dashboard-nav-grid facturacion-cfdi-grid">
              {FACTURACION_NAV.map((item) => (
                <Link
                  key={item.id}
                  href={item.path}
                  className="dash-nav-item"
                  data-accent={item.accent}
                >
                  <div className="dash-nav-icon" aria-hidden>
                    <FacturacionNavIcon name={item.icon} />
                  </div>
                  <div className="dash-nav-body">
                    <h2 className="dash-nav-title">{item.label}</h2>
                    <p className="dash-nav-desc">{item.desc}</p>
                    <span className="facturacion-cfdi-fase-badge">Fase {item.fase}</span>
                  </div>
                  <div className="dash-nav-arrow" aria-hidden>
                    <ChevronRight />
                  </div>
                </Link>
              ))}
            </div>
          ) : null}

          {children}
        </div>
      </div>
    </ProtectedRoute>
  )
}

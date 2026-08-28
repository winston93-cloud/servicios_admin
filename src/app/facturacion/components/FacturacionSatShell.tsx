'use client'

import type { AuthRole } from '@/lib/portalAuthService'
import ThemeToggle from '@/components/ThemeToggle'
import ProtectedRoute from '@/components/ProtectedRoute'
import { FACTURACION_SAT_NAV } from '@/lib/facturacionSatNav'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import FacturacionNavIcon from './FacturacionNavIcon'

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

type FacturacionSatShellProps = {
  title?: string
  subtitle?: string
  children: React.ReactNode
  /** Hub con tarjetas; subpantallas muestran pestañas de sección. */
  showHub?: boolean
  roles?: AuthRole[]
}

export default function FacturacionSatShell({
  title = 'Módulo SAT',
  subtitle = 'Descarga masiva de CFDI recibidos y conciliación fiscal',
  children,
  showHub = false,
  roles = ['usuario'],
}: FacturacionSatShellProps) {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <ProtectedRoute roles={roles}>
      <div className="dashboard-container facturacion-cfdi-page">
        <div className="dashboard-home-bg" aria-hidden="true" />
        <div className="dashboard-main">
          <div className="dashboard-heading reportes-heading facturacion-cfdi-heading">
            <button
              type="button"
              className="servicios-back-btn"
              onClick={() => router.push('/facturacion')}
            >
              <ArrowLeft size={16} aria-hidden />
              Volver a Facturación CFDI
            </button>
            <h1 className="dashboard-title">{title}</h1>
            <p className="dashboard-subtitle">{subtitle}</p>
            <div className="facturacion-cfdi-theme-row">
              <ThemeToggle />
            </div>
          </div>

          {showHub ? (
            <div className="dashboard-nav-grid facturacion-cfdi-grid">
              {FACTURACION_SAT_NAV.map((item) => (
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
                  </div>
                  <div className="dash-nav-arrow" aria-hidden>
                    <ChevronRight />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <nav
              className="facturacion-cfdi-sat-module-nav"
              aria-label="Secciones del módulo SAT"
            >
              {FACTURACION_SAT_NAV.map((item) => {
                const activo =
                  pathname === item.path || pathname.startsWith(`${item.path}/`)
                return (
                  <Link
                    key={item.id}
                    href={item.path}
                    className={`facturacion-cfdi-sat-module-tab${activo ? ' active' : ''}`}
                    aria-current={activo ? 'page' : undefined}
                  >
                    <FacturacionNavIcon name={item.icon} width={16} height={16} aria-hidden />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          )}

          {children}
        </div>
      </div>
    </ProtectedRoute>
  )
}

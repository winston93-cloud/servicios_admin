'use client'

import ThemeToggle from '@/components/ThemeToggle'
import { FACTURACION_SAT_NAV } from '@/lib/facturacionSatNav'
import { ArrowLeft, LogOut } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSatModuloAuth } from './FacturacionSatModuloGate'
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
}

export default function FacturacionSatShell({
  title = 'Módulo SAT',
  subtitle = 'Descarga masiva de CFDI recibidos y conciliación fiscal',
  children,
  showHub = false,
}: FacturacionSatShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { usuario, cerrarSesion } = useSatModuloAuth()

  const enHubSat = pathname === '/facturacion/sat'
  const volverHref = enHubSat ? '/facturacion' : '/facturacion/sat'
  const volverLabel = enHubSat ? 'Volver a Facturación CFDI' : 'Volver al módulo SAT'

  return (
    <div className="dashboard-container facturacion-cfdi-page">
        <div className="dashboard-home-bg" aria-hidden="true" />
        <div className="dashboard-main">
          <div className="dashboard-heading reportes-heading facturacion-cfdi-heading">
            <button
              type="button"
              className="servicios-back-btn"
              onClick={() => router.push(volverHref)}
            >
              <ArrowLeft size={16} aria-hidden />
              {volverLabel}
            </button>
            <h1 className="dashboard-title">{title}</h1>
            <p className="dashboard-subtitle">{subtitle}</p>
            <div className="facturacion-cfdi-theme-row facturacion-cfdi-sat-session-row">
              {usuario ? (
                <span className="facturacion-cfdi-sat-session-user">
                  Sesión: <strong>{usuario}</strong>
                </span>
              ) : null}
              <button
                type="button"
                className="facturacion-cfdi-sat-btn-secondary facturacion-cfdi-sat-logout-btn"
                onClick={() => void cerrarSesion()}
              >
                <LogOut size={14} aria-hidden />
                Salir
              </button>
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
  )
}

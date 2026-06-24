'use client'

import { urlProrrogasAjustesApp } from '@/lib/prorrogasAjustesConfig'
import { urlCchicApp } from '@/lib/cchicConfig'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import ThemeToggle from '@/components/ThemeToggle'
import Image from 'next/image'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { obtenerCicloEscolarActual } from '@/lib/ciclosEscolaresService'

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

type DashboardNavItem = {
  label: string
  desc: string
  accent: 'amber' | 'indigo' | 'violet' | 'rose' | 'emerald' | 'sky'
  icon: ReactNode
  path?: string
  href?: string
}

function navItemKey(item: DashboardNavItem): string {
  return item.path ?? item.href ?? item.label
}

function abrirNavItem(item: DashboardNavItem, push: (path: string) => void) {
  if (item.href) {
    window.open(item.href, '_blank', 'noopener,noreferrer')
    return
  }
  if (item.path) push(item.path)
}

const ICON_DESAYUNOS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 8h1a4 4 0 0 1 0 8h-1"/>
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/>
    <line x1="6" y1="1" x2="6" y2="4"/>
    <line x1="10" y1="1" x2="10" y2="4"/>
    <line x1="14" y1="1" x2="14" y2="4"/>
  </svg>
)

/** Módulos del personal administrativo (sin portales de familias). */
const NAV_ITEMS_ADMIN: DashboardNavItem[] = [
  {
    label: 'Desayunos, Estancias y Comidas',
    desc: 'Servicios de alimentación y cuidado escolar',
    path: '/pos',
    accent: 'amber',
    icon: ICON_DESAYUNOS,
  },
  {
    label: 'Servicios',
    desc: 'Gestión general de servicios escolares',
    path: '/servicios',
    accent: 'indigo',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2"/>
        <polyline points="2 17 12 22 22 17"/>
        <polyline points="2 12 12 17 22 12"/>
      </svg>
    ),
  },
  {
    label: 'Reportes',
    desc: 'Consulta y generación de reportes administrativos',
    path: '/reportes',
    accent: 'violet',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    label: 'Prórrogas y Ajustes',
    desc: 'Gestión de prórrogas y ajustes de pago escolar',
    href: urlProrrogasAjustesApp(),
    accent: 'rose',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <circle cx="12" cy="16" r="3"/>
        <polyline points="12 14 12 16 13.5 17.5"/>
      </svg>
    ),
  },
  {
    label: 'Agenda psicólogas',
    desc: 'Calendario y citas del área de psicología',
    href: 'https://agendaw.vercel.app/admin/',
    accent: 'sky',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <path d="M12 14v4"/>
        <path d="M10 16h4"/>
      </svg>
    ),
  },
  {
    label: 'Agenda directoras',
    desc: 'Panel de agenda para dirección escolar',
    href: 'https://agendaw.vercel.app/admin/dashboard',
    accent: 'violet',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <path d="M7 14h4"/>
        <path d="M7 18h7"/>
        <path d="M14 14h3"/>
      </svg>
    ),
  },
  {
    label: 'Open House/Sesiones Inf. Admin',
    desc: 'Inscripciones y gestión de Open House y sesiones informativas',
    href: 'https://open-house-chi.vercel.app/admin',
    accent: 'emerald',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5L12 3l9 7.5"/>
        <path d="M5 10v10h14V10"/>
        <path d="M9 20v-6h6v6"/>
        <path d="M12 7v3"/>
        <path d="M10.5 9.5h3"/>
      </svg>
    ),
  },
  {
    label: 'Monitoreo y Control',
    desc: 'Caja chica, egresos, fondos y reportes de control',
    href: urlCchicApp(),
    accent: 'indigo',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V10"/>
        <path d="M18 20V4"/>
        <path d="M6 20v-4"/>
        <rect x="3" y="2" width="18" height="4" rx="1"/>
        <path d="M7 6v2"/>
        <path d="M12 6v2"/>
        <path d="M17 6v2"/>
      </svg>
    ),
  },
  {
    label: 'Facturación CFDI',
    desc: 'Timbrado, cancelaciones y devoluciones fiscales',
    path: '/facturacion',
    accent: 'emerald',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2h16v20l-4-2-4 2-4-2-4 2V2z"/>
        <path d="M8 7h8"/>
        <path d="M8 11h8"/>
        <path d="M8 15h5"/>
      </svg>
    ),
  },
]

/** Portales en línea solo para alumnos / familias. */
const NAV_ITEMS_ALUMNO: DashboardNavItem[] = [
  {
    label: 'Desayunos, Estancias y Comidas',
    desc: 'Servicios de alimentación y cuidado escolar',
    path: '/portal-desayunos',
    accent: 'amber',
    icon: ICON_DESAYUNOS,
  },
  {
    label: 'Portal de pagos',
    desc: 'Consulta y registro de pagos en línea',
    path: '/portal-pagos',
    accent: 'emerald',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2"/>
        <line x1="2" y1="10" x2="22" y2="10"/>
        <path d="M6 15h.01"/>
        <path d="M10 15h4"/>
      </svg>
    ),
  },
  {
    label: 'Portal de inscripciones',
    desc: 'Registro y seguimiento de inscripciones en línea',
    path: '/portal-inscripciones',
    accent: 'sky',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <line x1="19" y1="8" x2="19" y2="14"/>
        <line x1="22" y1="11" x2="16" y2="11"/>
      </svg>
    ),
  },
  {
    label: 'Portal de facturación',
    desc: 'Datos fiscales para facturación electrónica (CFDI)',
    path: '/portal-facturacion',
    accent: 'violet',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
]

export default function DashboardPage() {
  const { user, session, logout, isAlumno } = useAuth()
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [cicloVigenteNombre, setCicloVigenteNombre] = useState<string | null>(null)

  const handleLogout = async () => {
    try {
      await logout()
      router.replace('/login')
    } catch {
      router.replace('/login')
    }
  }

  const navigate = (path: string) => {
    router.push(path)
    setIsMenuOpen(false)
  }

  const handleNavItem = (item: DashboardNavItem) => {
    abrirNavItem(item, router.push)
    setIsMenuOpen(false)
  }

  const toggleMenu = () => setIsMenuOpen((open) => !open)
  const closeMenu = () => setIsMenuOpen(false)

  useEffect(() => {
    if (!isAlumno) {
      setCicloVigenteNombre(null)
      return
    }
    let cancelado = false
    void obtenerCicloEscolarActual().then((c) => {
      if (!cancelado) setCicloVigenteNombre(c?.nombre ?? null)
    })
    return () => {
      cancelado = true
    }
  }, [isAlumno])

  useEffect(() => {
    if (!isMenuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [isMenuOpen])

  const primerNombre =
    session?.displayName?.trim().split(/\s+/)[0] ||
    user?.usuario_nombre_completo?.trim().split(/\s+/)[0] ||
    'equipo'

  const saludo = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buenos días'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  const navItems = useMemo(
    () => (isAlumno ? [...NAV_ITEMS_ALUMNO] : [...NAV_ITEMS_ADMIN]),
    [isAlumno]
  )

  const subtituloDashboard = isAlumno
    ? 'Accede a tus portales en línea'
    : 'Selecciona un módulo para continuar'

  return (
    <ProtectedRoute>
      <div className="dashboard-container dashboard-home">
        <div className="dashboard-home-bg" aria-hidden="true" />

        {/* Header */}
        <div className="dashboard-header">
          <button
            type="button"
            className="dashboard-hamburger-btn"
            onClick={toggleMenu}
            aria-expanded={isMenuOpen}
            aria-controls="dashboard-system-menu"
            aria-label={isMenuOpen ? 'Cerrar menú del sistema' : 'Abrir menú del sistema'}
          >
            <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
          </button>

          <div className="dashboard-header-brand" aria-hidden="true">
            <Image
              src="/logos/logo-winston-churchill.png"
              alt=""
              width={120}
              height={90}
              className="dashboard-header-logo dashboard-header-logo--churchill"
              priority
            />
            <Image
              src="/logos/logo-winston-educativo.png"
              alt=""
              width={120}
              height={90}
              className="dashboard-header-logo dashboard-header-logo--educativo"
              priority
            />
          </div>

          <div className="dashboard-user-info">
            <span className="dashboard-welcome">
              Bienvenido, {session?.displayName ?? user?.usuario_nombre_completo}
            </span>
            <ThemeToggle />
            <button onClick={handleLogout} className="dashboard-logout-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="dashboard-main">
          <div className="dashboard-main-stage">
            <aside className="dashboard-flank dashboard-flank--start">
              <Image
                src="/logos/logo-winston-churchill.png"
                alt="Instituto Winston Churchill"
                width={160}
                height={120}
                className="dashboard-flank-logo saas-logo-glow"
                priority
              />
              <span className="dashboard-flank-label">Instituto Winston Churchill</span>
            </aside>

            <div className="dashboard-main-center">
              <div className="dashboard-mobile-logos" aria-hidden="true">
                <Image
                  src="/logos/logo-winston-churchill.png"
                  alt=""
                  width={88}
                  height={66}
                  className="dashboard-mobile-logo saas-logo-glow"
                  priority
                />
                <Image
                  src="/logos/logo-winston-educativo.png"
                  alt=""
                  width={88}
                  height={66}
                  className="dashboard-mobile-logo saas-logo-glow"
                  priority
                />
              </div>

              <div className="dashboard-heading">
                <p className="dashboard-greeting">
                  {saludo}, <span className="dashboard-greeting-name">{primerNombre}</span>
                </p>
                <h1 className="dashboard-title">Servicios Administrativos</h1>
                <p className="dashboard-subtitle">{subtituloDashboard}</p>
                {isAlumno && cicloVigenteNombre && (
                  <p className="dashboard-ciclo-vigente" role="status">
                    <span className="dashboard-ciclo-vigente-label">Ciclo escolar vigente</span>
                    <span className="dashboard-ciclo-vigente-nombre">{cicloVigenteNombre}</span>
                  </p>
                )}
              </div>

              <div className="dashboard-nav-grid">
                {navItems.map((item) => (
                  <div
                    key={navItemKey(item)}
                    className="dash-nav-item"
                    data-accent={item.accent}
                    onClick={() => handleNavItem(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleNavItem(item)
                    }}
                  >
                    <div className="dash-nav-icon">{item.icon}</div>
                    <div className="dash-nav-body">
                      <h2 className="dash-nav-title">{item.label}</h2>
                      <p className="dash-nav-desc">{item.desc}</p>
                    </div>
                    <div className="dash-nav-arrow" aria-hidden="true"><ChevronRight /></div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="dashboard-flank dashboard-flank--end">
              <Image
                src="/logos/logo-winston-educativo.png"
                alt="Winston Educativo"
                width={160}
                height={120}
                className="dashboard-flank-logo saas-logo-glow dashboard-flank-logo--end"
                priority
              />
              <span className="dashboard-flank-label">Winston Educativo</span>
            </aside>
          </div>
        </div>

        {/* Overlay */}
        {isMenuOpen && (
          <div
            className="dashboard-overlay"
            onClick={closeMenu}
            aria-hidden
          />
        )}

        {/* Sidebar — opciones del sistema */}
        <nav
          id="dashboard-system-menu"
          className={`dashboard-sidebar ${isMenuOpen ? 'open' : ''}`}
          aria-label="Opciones del sistema"
          aria-hidden={!isMenuOpen}
        >
          <div className="dashboard-sidebar-header">
            <div className="dashboard-sidebar-logos">
              <Image
                src="/logos/logo-winston-churchill.png"
                alt="Instituto Winston Churchill"
                width={56}
                height={42}
                className="dashboard-sidebar-institution-logo"
              />
              <Image
                src="/logos/logo-winston-educativo.png"
                alt="Winston Educativo"
                width={56}
                height={42}
                className="dashboard-sidebar-institution-logo"
              />
            </div>
            <div className="dashboard-sidebar-title">
              <h3>Menú del sistema</h3>
              <p>Opciones disponibles</p>
            </div>
            <button
              type="button"
              className="dashboard-sidebar-close"
              onClick={closeMenu}
              aria-label="Cerrar menú"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="dashboard-sidebar-menu">
            <button
              type="button"
              className="dashboard-menu-item dashboard-menu-item--inicio"
              onClick={() => navigate('/dashboard')}
            >
              <div className="dashboard-menu-item-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <div className="dashboard-menu-text">
                <h4>Inicio</h4>
                <p>Panel principal</p>
              </div>
            </button>
            {navItems.map((item) => (
              <button
                key={navItemKey(item)}
                type="button"
                className="dashboard-menu-item"
                data-accent={item.accent}
                onClick={() => handleNavItem(item)}
              >
                <div className="dashboard-menu-item-icon" aria-hidden>{item.icon}</div>
                <div className="dashboard-menu-text">
                  <h4>{item.label}</h4>
                  <p>{item.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <button type="button" onClick={handleLogout} className="dashboard-sidebar-logout">
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Cerrar sesión</span>
          </button>
        </nav>

      </div>
    </ProtectedRoute>
  )
}

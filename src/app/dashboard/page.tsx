'use client'

import { urlBecasAlumnoApp, urlBoletasAlumnoApp } from '@/lib/dashboardModulosConfig'
import {
  NAV_ITEMS_ADMIN,
  abrirNavItem,
  navItemKey,
  type DashboardAdminNavItem,
} from '@/lib/dashboardNavAdmin'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import ThemeToggle from '@/components/ThemeToggle'
import DashboardModuleCard from '@/components/dashboard/DashboardModuleCard'
import Image from 'next/image'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { obtenerCicloEscolarActual } from '@/lib/ciclosEscolaresService'
import './dashboard-module-card.css'

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

type DashboardNavItem = {
  label: string
  desc: string
  accent: DashboardAdminNavItem['accent']
  icon: ReactNode
  path?: string
  href?: string
}

function abrirNavItemAlumno(item: DashboardNavItem, push: (path: string) => void) {
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
    label: 'Portal de Inscripciones y Colegiaturas',
    desc: 'Inscripción, reinscripción y pagos de colegiatura en línea',
    path: '/portal-inscripciones',
    accent: 'sky',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10 12 5 2 10l10 5 10-5z"/>
        <path d="M6 12v5c0 1 2.686 2.5 6 2.5s6-1.5 6-2.5v-5"/>
        <line x1="22" y1="10" x2="22" y2="15"/>
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
  {
    label: 'Boletas',
    desc: 'Consulta de boletas y calificaciones escolares',
    href: urlBoletasAlumnoApp(),
    accent: 'indigo',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        <line x1="8" y1="7" x2="16" y2="7"/>
        <line x1="8" y1="11" x2="16" y2="11"/>
        <line x1="8" y1="15" x2="12" y2="15"/>
      </svg>
    ),
  },
  {
    label: 'Becas',
    desc: 'Portal de becas integrales y solicitud en línea',
    href: urlBecasAlumnoApp(),
    accent: 'amber',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
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

  const handleNavItemAdmin = (item: DashboardAdminNavItem) => {
    abrirNavItem(item, router.push)
    setIsMenuOpen(false)
  }

  const handleNavItemAlumno = (item: DashboardNavItem) => {
    abrirNavItemAlumno(item, router.push)
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

  const navItemsAdmin = useMemo(() => [...NAV_ITEMS_ADMIN], [])
  const navItemsAlumno = useMemo(() => [...NAV_ITEMS_ALUMNO], [])

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
                {isAlumno
                  ? navItemsAlumno.map((item) => (
                      <div
                        key={navItemKey(item)}
                        className="dash-nav-item"
                        data-accent={item.accent}
                        onClick={() => handleNavItemAlumno(item)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') handleNavItemAlumno(item)
                        }}
                      >
                        <div className="dash-nav-icon">{item.icon}</div>
                        <div className="dash-nav-body">
                          <h2 className="dash-nav-title">{item.label}</h2>
                          <p className="dash-nav-desc">{item.desc}</p>
                        </div>
                        <div className="dash-nav-arrow" aria-hidden="true">
                          <ChevronRight />
                        </div>
                      </div>
                    ))
                  : navItemsAdmin.map((item) => (
                      <DashboardModuleCard
                        key={navItemKey(item)}
                        label={item.label}
                        desc={item.desc}
                        accent={item.accent}
                        icon={item.icon}
                        kicker={item.kicker}
                        badge={item.badge}
                        tags={item.tags}
                        featured={item.featured}
                        external={Boolean(item.href)}
                        onActivate={() => handleNavItemAdmin(item)}
                      />
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
            {isAlumno
              ? navItemsAlumno.map((item) => (
                  <button
                    key={navItemKey(item)}
                    type="button"
                    className="dashboard-menu-item"
                    data-accent={item.accent}
                    onClick={() => handleNavItemAlumno(item)}
                  >
                    <div className="dashboard-menu-item-icon" aria-hidden>
                      {item.icon}
                    </div>
                    <div className="dashboard-menu-text">
                      <h4>{item.label}</h4>
                      <p>{item.desc}</p>
                    </div>
                  </button>
                ))
              : navItemsAdmin.map((item) => (
                  <button
                    key={navItemKey(item)}
                    type="button"
                    className="dashboard-menu-item"
                    data-accent={item.accent}
                    onClick={() => handleNavItemAdmin(item)}
                  >
                    <div className="dashboard-menu-item-icon" aria-hidden>
                      {item.icon}
                    </div>
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

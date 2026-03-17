'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useState } from 'react'
import NotificacionesModal from '@/app/components/NotificacionesModal'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [openNotificaciones, setOpenNotificaciones] = useState(false)

  const handleDesayunosClick = () => {
    router.push('/pos')
    setIsMenuOpen(false)
  }

  const handleOpenNotificaciones = () => {
    console.log('Abriendo modal de Notificaciones')
    setOpenNotificaciones(true)
  }

  const handleLogout = async () => {
    try {
      console.log('Iniciando logout desde dashboard...')
      await logout()
      console.log('Logout completado, redirigiendo a login...')
      // Usar replace para evitar que el usuario pueda volver atrás
      router.replace('/login')
    } catch (error) {
      console.error('Error durante logout:', error)
      // Si hay error, forzar la redirección
      router.replace('/login')
    }
  }

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  return (
    <ProtectedRoute>
      <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-menu-icon" onClick={toggleMenu}>
          <svg fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
        </div>
        
        <div className="dashboard-logo">
          <div className="dashboard-logo-icon">
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
        </div>

        <div className="dashboard-user-info">
          <span className="dashboard-welcome">⭐ Bienvenido, {user?.usuario_nombre_completo} ⭐</span>
          <button onClick={handleLogout} className="dashboard-logout-btn">
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-main">
        <div className="dashboard-heading">
          <h1 className="dashboard-title">Servicios Administrativos</h1>
          <p className="dashboard-subtitle">Selecciona un módulo para continuar</p>
        </div>

        {/* Navigation Grid */}
        <div className="dashboard-nav-grid">

          <div className="dash-nav-item" onClick={handleDesayunosClick} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleDesayunosClick() }}>
            <div className="dash-nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 8h1a4 4 0 0 1 0 8h-1"/>
                <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/>
                <line x1="6" y1="1" x2="6" y2="4"/>
                <line x1="10" y1="1" x2="10" y2="4"/>
                <line x1="14" y1="1" x2="14" y2="4"/>
              </svg>
            </div>
            <div className="dash-nav-body">
              <h2 className="dash-nav-title">Desayunos, Estancias y Comidas</h2>
              <p className="dash-nav-desc">Servicios de alimentación y cuidado escolar</p>
            </div>
            <div className="dash-nav-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </div>

          <div className="dash-nav-item" onClick={handleOpenNotificaciones} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenNotificaciones() }}>
            <div className="dash-nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <div className="dash-nav-body">
              <h2 className="dash-nav-title">Notificaciones</h2>
              <p className="dash-nav-desc">Enviar avisos y comunicados a padres de familia</p>
            </div>
            <div className="dash-nav-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </div>

          <div className="dash-nav-item" onClick={() => router.push('/servicios-internos')} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push('/servicios-internos') }}>
            <div className="dash-nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </div>
            <div className="dash-nav-body">
              <h2 className="dash-nav-title">Servicios Internos</h2>
              <p className="dash-nav-desc">Gestión de servicios administrativos internos</p>
            </div>
            <div className="dash-nav-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </div>

          <div className="dash-nav-item" onClick={() => router.push('/boletas')} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push('/boletas') }}>
            <div className="dash-nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/>
                <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/>
              </svg>
            </div>
            <div className="dash-nav-body">
              <h2 className="dash-nav-title">Boletas y Calificaciones</h2>
              <p className="dash-nav-desc">Gestión académica y evaluaciones escolares</p>
            </div>
            <div className="dash-nav-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </div>

          <div className="dash-nav-item" onClick={() => router.push('/reportes')} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push('/reportes') }}>
            <div className="dash-nav-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </div>
            <div className="dash-nav-body">
              <h2 className="dash-nav-title">Reportes y Estadísticas</h2>
              <p className="dash-nav-desc">Análisis de datos y reportes ejecutivos</p>
            </div>
            <div className="dash-nav-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </div>

          <div className="dash-nav-item" onClick={() => router.push('/entrega-ninos')} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push('/entrega-ninos') }}>
            <div className="dash-nav-icon">
              {/* Persona caminando con niño */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="14" cy="3.5" r="1.5"/>
                <path d="M10 8.5c1.5-1 4-1 4.5 1.5L16 14"/>
                <path d="M8.5 21l2-5.5 1.5-2"/>
                <path d="M16 14l-2.5 7"/>
                <path d="M8 11l-2 3"/>
                <circle cx="6.5" cy="6.5" r="1.2"/>
                <path d="M6.5 7.7v3l1.5 2"/>
                <path d="M5 14l2-3.3"/>
                <path d="M6.5 10.7 5 14"/>
              </svg>
            </div>
            <div className="dash-nav-body">
              <h2 className="dash-nav-title">Entrega de Niños a Pie</h2>
              <p className="dash-nav-desc">Registro y control de salida peatonal de alumnos</p>
            </div>
            <div className="dash-nav-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </div>

        </div>
      </div>

      {/* Overlay */}
      {isMenuOpen && <div className="dashboard-overlay" onClick={() => setIsMenuOpen(false)}></div>}

      {/* Sidebar Menu */}
      <div className={`dashboard-sidebar ${isMenuOpen ? 'open' : ''}`}>
        <div className="dashboard-sidebar-header">
          <div className="dashboard-sidebar-logo">
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div className="dashboard-sidebar-title">
            <h3>Menú Principal</h3>
            <p>Winston Churchill</p>
          </div>
        </div>

        <div className="dashboard-sidebar-menu">
          <div className="dashboard-menu-item" onClick={handleDesayunosClick}>
            <div className="dashboard-menu-icon">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M8.1 13.34l2.83-2.83L12.93 12l-1.59 1.59c-.24.24-.24.63 0 .87.12.12.28.18.44.18s.32-.06.44-.18L15.13 11.5c.24-.24.24-.63 0-.87-.24-.24-.63-.24-.87 0l-.88.88-.88-.88c-.24-.24-.63-.24-.87 0s-.24.63 0 .87l2.83 2.83zM12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <div className="dashboard-menu-text">
              <h4>Desayunos, Estancias y Comidas</h4>
              <p>Servicios de alimentación escolar</p>
            </div>
          </div>

          <div className="dashboard-menu-item" onClick={() => { router.push('/servicios-internos'); setIsMenuOpen(false); }}>
            <div className="dashboard-menu-icon">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div className="dashboard-menu-text">
              <h4>Servicios Internos</h4>
              <p>Gestión administrativa interna</p>
            </div>
          </div>

          <div className="dashboard-menu-item" onClick={() => { router.push('/boletas'); setIsMenuOpen(false); }}>
            <div className="dashboard-menu-icon">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z M6 20V4h7v5h5v11H6z M8 12h8v2H8v-2z M8 16h8v2H8v-2z M8 8h5v2H8V8z"/>
              </svg>
            </div>
            <div className="dashboard-menu-text">
              <h4>Boletas y Calificaciones</h4>
              <p>Sistema de gestión académica</p>
            </div>
          </div>

          <div className="dashboard-menu-item" onClick={() => { router.push('/reportes'); setIsMenuOpen(false); }}>
            <div className="dashboard-menu-icon">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </div>
            <div className="dashboard-menu-text">
              <h4>Reportes y Estadísticas</h4>
              <p>Análisis de datos ejecutivos</p>
            </div>
          </div>

          <div className="dashboard-menu-item" onClick={() => { router.push('/entrega-ninos'); setIsMenuOpen(false); }}>
            <div className="dashboard-menu-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="14" cy="3.5" r="1.5"/>
                <path d="M10 8.5c1.5-1 4-1 4.5 1.5L16 14"/>
                <path d="M8.5 21l2-5.5 1.5-2"/>
                <path d="M16 14l-2.5 7"/>
                <path d="M8 11l-2 3"/>
                <circle cx="6.5" cy="6.5" r="1.2"/>
                <path d="M6.5 7.7v3l1.5 2"/>
                <path d="M5 14l2-3.3"/>
                <path d="M6.5 10.7 5 14"/>
              </svg>
            </div>
            <div className="dashboard-menu-text">
              <h4>Entrega de Niños a Pie</h4>
              <p>Control de salida peatonal de alumnos</p>
            </div>
          </div>
        </div>

        <button onClick={handleLogout} className="dashboard-sidebar-logout">
          <svg fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
          </svg>
          Cerrar Sesión
        </button>
      </div>

      {/* Modal Notificaciones */}
      <NotificacionesModal isOpen={openNotificaciones} onClose={() => setOpenNotificaciones(false)} />
    </div>
    </ProtectedRoute>
  )
}

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
        <h1 className="dashboard-title">
          Servicios Administrativos Winston
        </h1>
        <div className="dashboard-star">⭐</div>

        {/* Services Cards Grid */}
        <div className="dashboard-cards-grid">
          {/* Desayunos Card */}
          <div className="dashboard-card" onClick={handleDesayunosClick}>
            <div className="dashboard-card-icon orange">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M8.1 13.34l2.83-2.83L12.93 12l-1.59 1.59c-.24.24-.24.63 0 .87.12.12.28.18.44.18s.32-.06.44-.18L15.13 11.5c.24-.24.24-.63 0-.87-.24-.24-.63-.24-.87 0l-.88.88-.88-.88c-.24-.24-.63-.24-.87 0s-.24.63 0 .87l2.83 2.83zM12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            
            <div className="dashboard-card-content">
              <h2 className="dashboard-card-title">
                Desayunos, Estancias<br />
                y Comidas
              </h2>
              <p className="dashboard-card-subtitle">
                Servicios de alimentación y cuidado<br />
                escolar
              </p>
            </div>
          </div>

          {/* Notificaciones Card */}
          <div className="dashboard-card" onClick={handleOpenNotificaciones} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenNotificaciones() }}>
            <div className="dashboard-card-icon red">
              <span className="dashboard-emoji" role="img" aria-label="campana">🔔</span>
            </div>
            
            <div className="dashboard-card-content">
              <h2 className="dashboard-card-title">Notificaciones</h2>
              <p className="dashboard-card-subtitle">Enviar aviso a padres</p>
            </div>
          </div>

          {/* Servicios Internos Card */}
          <div className="dashboard-card" onClick={() => router.push('/servicios-internos')}>
            <div className="dashboard-card-icon blue">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            
            <div className="dashboard-card-content">
              <h2 className="dashboard-card-title">
                Servicios<br />
                Internos
              </h2>
              <p className="dashboard-card-subtitle">
                Gestión de servicios<br />
                administrativos internos
              </p>
            </div>
          </div>

          {/* Boletas Card */}
          <div className="dashboard-card" onClick={() => router.push('/boletas')}>
            <div className="dashboard-card-icon green">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z M6 20V4h7v5h5v11H6z M8 12h8v2H8v-2z M8 16h8v2H8v-2z M8 8h5v2H8V8z"/>
              </svg>
            </div>
            
            <div className="dashboard-card-content">
              <h2 className="dashboard-card-title">
                Boletas<br />
                y Calificaciones
              </h2>
              <p className="dashboard-card-subtitle">
                Sistema de gestión<br />
                académica y evaluaciones
              </p>
            </div>
          </div>

          {/* Reportes Card */}
          <div className="dashboard-card" onClick={() => router.push('/reportes')}>
            <div className="dashboard-card-icon purple">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 3v18h18V3H3zm16 16H5V5h14v14zM7 12h2v5H7v-5zm4-3h2v8h-2V9zm4-3h2v11h-2V6z"/>
              </svg>
            </div>
            
            <div className="dashboard-card-content">
              <h2 className="dashboard-card-title">
                Reportes<br />
                y Estadísticas
              </h2>
              <p className="dashboard-card-subtitle">
                Análisis de datos<br />
                y reportes ejecutivos
              </p>
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
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 3v18h18V3H3zm16 16H5V5h14v14zM7 12h2v5H7v-5zm4-3h2v8h-2V9zm4-3h2v11h-2V6z"/>
              </svg>
            </div>
            <div className="dashboard-menu-text">
              <h4>Reportes y Estadísticas</h4>
              <p>Análisis de datos ejecutivos</p>
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

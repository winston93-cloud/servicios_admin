'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useState } from 'react'

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

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

  const navItems = [
    {
      label: 'Entrega de Niños a Pie',
      desc: 'Registro y control de salida peatonal de alumnos',
      path: '/entrega-ninos',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="14" cy="3.5" r="1.5"/>
          <path d="M10 8.5c1.5-1 4-1 4.5 1.5L16 14"/>
          <path d="M8.5 21l2-5.5 1.5-2"/>
          <path d="M16 14l-2.5 7"/>
          <circle cx="6.5" cy="6.5" r="1.2"/>
          <path d="M6.5 7.7v3l1.5 2"/>
          <path d="M5 14l2-3.3"/>
          <path d="M6.5 10.7 5 14"/>
        </svg>
      ),
    },
    {
      label: 'Desayunos, Estancias y Comidas',
      desc: 'Servicios de alimentación y cuidado escolar',
      path: '/pos',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 8h1a4 4 0 0 1 0 8h-1"/>
          <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/>
          <line x1="6" y1="1" x2="6" y2="4"/>
          <line x1="10" y1="1" x2="10" y2="4"/>
          <line x1="14" y1="1" x2="14" y2="4"/>
        </svg>
      ),
    },
    {
      label: 'Boletas y Calificaciones',
      desc: 'Gestión académica y evaluaciones escolares',
      path: '/boletas',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/>
          <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/>
        </svg>
      ),
    },
    {
      label: 'Servicios',
      desc: 'Gestión general de servicios escolares',
      path: '/servicios',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"/>
          <polyline points="2 17 12 22 22 17"/>
          <polyline points="2 12 12 17 22 12"/>
        </svg>
      ),
    },
  ]

  return (
    <ProtectedRoute>
      <div className="dashboard-container">

        {/* Header */}
        <div className="dashboard-header">
          <div className="dashboard-menu-icon" onClick={() => setIsMenuOpen(true)}>
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
          </div>

          <div className="dashboard-logo">
            <div className="dashboard-logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
          </div>

          <div className="dashboard-user-info">
            <span className="dashboard-welcome">Bienvenido, {user?.usuario_nombre_completo}</span>
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
          <div className="dashboard-heading">
            <h1 className="dashboard-title">Servicios Administrativos</h1>
            <p className="dashboard-subtitle">Selecciona un módulo para continuar</p>
          </div>

          <div className="dashboard-nav-grid">
            {navItems.map((item) => (
              <div
                key={item.path}
                className="dash-nav-item"
                onClick={() => navigate(item.path)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(item.path) }}
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

        {/* Overlay */}
        {isMenuOpen && <div className="dashboard-overlay" onClick={() => setIsMenuOpen(false)} />}

        {/* Sidebar */}
        <div className={`dashboard-sidebar ${isMenuOpen ? 'open' : ''}`}>
          <div className="dashboard-sidebar-header">
            <div className="dashboard-sidebar-logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div className="dashboard-sidebar-title">
              <h3>Menú Principal</h3>
              <p>Winston Churchill</p>
            </div>
          </div>

          <div className="dashboard-sidebar-menu">
            {navItems.map((item) => (
              <div key={item.path} className="dashboard-menu-item" onClick={() => navigate(item.path)}>
                <div className="dashboard-menu-icon">{item.icon}</div>
                <div className="dashboard-menu-text">
                  <h4>{item.label}</h4>
                  <p>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleLogout} className="dashboard-sidebar-logout">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Cerrar Sesión
          </button>
        </div>

      </div>
    </ProtectedRoute>
  )
}

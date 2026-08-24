'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import ThemeToggle from '@/components/ThemeToggle'
import DashboardModuleCard from '@/components/dashboard/DashboardModuleCard'
import { reportesConductaHubItems } from '@/lib/reportesConductaHubNav'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import '../dashboard/dashboard-module-card.css'
import './reportes-conducta.css'

function ReportesConductaHubView() {
  const router = useRouter()
  const items = reportesConductaHubItems()

  return (
    <div className="dashboard-container dashboard-home reportes-conducta-page">
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
          <h1 className="dashboard-title">Reportes académicos y de conducta</h1>
          <p className="dashboard-subtitle">
            Elige el nivel escolar para captura y seguimiento de reportes.
          </p>
          <div className="facturacion-cfdi-theme-row">
            <ThemeToggle />
          </div>
        </div>

        <div className="dashboard-nav-grid reportes-conducta-grid" role="list">
          {items.map((item, index) => (
            <div key={item.id} role="listitem">
              <DashboardModuleCard
                order={index + 1}
                label={item.label}
                desc={item.desc}
                accent={item.accent}
                icon={item.icon}
                kicker={item.kicker}
                tags={item.tags}
                onActivate={() => {
                  if (item.id === 'secundaria') router.push('/reportes-conducta/secundaria')
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ReportesConductaHubPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <ReportesConductaHubView />
    </ProtectedRoute>
  )
}

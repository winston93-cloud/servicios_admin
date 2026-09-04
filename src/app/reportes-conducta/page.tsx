'use client'

import ThemeToggle from '@/components/ThemeToggle'
import DashboardModuleCard from '@/components/dashboard/DashboardModuleCard'
import { reportesConductaHubItems } from '@/lib/reportesConductaHubNav'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import '../dashboard/dashboard-module-card.css'
import './reportes-conducta.css'

/**
 * Hub público: 3 tarjetas → cada nivel tiene su propio login de maestro/staff.
 * No exige sesión de Servicios (las directoras/maestros llegan por enlace directo).
 */
export default function ReportesConductaHubPage() {
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
            Elige el nivel escolar. Después inicia sesión con tu usuario y contraseña de maestro o staff.
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
                  if (item.id === 'primaria') router.push('/reportes-conducta/primaria')
                  if (item.id === 'kinder') router.push('/reportes-conducta/maternal-kinder')
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

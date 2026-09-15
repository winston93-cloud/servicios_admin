'use client'

import ThemeToggle from '@/components/ThemeToggle'
import DashboardModuleCard from '@/components/dashboard/DashboardModuleCard'
import { boletasHubItems } from '@/lib/boletasHubNav'
import { ArrowLeft, GraduationCap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import '../dashboard/dashboard-module-card.css'
import './boletas-hub.css'

export default function BoletasHubPage() {
  const router = useRouter()
  const items = boletasHubItems()
  const activos = items.filter((i) => i.activo).length

  return (
    <div className="dashboard-container dashboard-home boletas-hub-page">
      <div className="dashboard-home-bg" aria-hidden="true" />
      <div className="boletas-hub-atmosphere" aria-hidden="true">
        <span className="boletas-hub-orb boletas-hub-orb--a" />
        <span className="boletas-hub-orb boletas-hub-orb--b" />
        <span className="boletas-hub-grid" />
      </div>

      <div className="dashboard-main boletas-hub-main">
        <div className="dashboard-heading reportes-heading facturacion-cfdi-heading boletas-hub-heading">
          <button
            type="button"
            className="servicios-back-btn"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft size={16} aria-hidden />
            Volver al inicio
          </button>

          <p className="boletas-hub-brand">
            <GraduationCap size={18} aria-hidden />
            Instituto Winston Churchill
          </p>
          <h1 className="dashboard-title boletas-hub-title">
            Sistema Integral de Boletas Escolares
          </h1>
          <p className="dashboard-subtitle boletas-hub-lead">
            Cinco módulos de boletas por nivel e idioma. Elige el sistema con el que vas a
            capturar, consultar o emitir calificaciones.
          </p>

          <div className="boletas-hub-meta">
            <span className="boletas-hub-pill">
              <strong>{items.length}</strong> sistemas
            </span>
            <span className="boletas-hub-pill boletas-hub-pill--live">
              <strong>{activos}</strong> activo{activos === 1 ? '' : 's'}
            </span>
            <span className="boletas-hub-pill">Kinder · Primaria · Secundaria</span>
            <div className="facturacion-cfdi-theme-row">
              <ThemeToggle />
            </div>
          </div>
        </div>

        <section className="boletas-hub-section" aria-label="Módulos de boletas">
          <div className="boletas-hub-section-head">
            <h2>Módulos</h2>
            <p>Preescolar y primaria tienen boleta en español y en inglés. Secundaria usa una sola boleta.</p>
          </div>

          <div className="dashboard-nav-grid boletas-hub-grid" role="list">
            {items.map((item, index) => (
              <div key={item.id} role="listitem" className={item.activo ? 'boletas-hub-item--live' : undefined}>
                <DashboardModuleCard
                  order={index + 1}
                  label={item.label}
                  desc={item.desc}
                  accent={item.accent}
                  icon={item.icon}
                  kicker={item.kicker}
                  tags={item.tags}
                  badge={item.activo ? 'Activo' : 'Próximo'}
                  featured={item.activo}
                  onActivate={() => router.push(item.path)}
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

'use client'

import ThemeToggle from '@/components/ThemeToggle'
import DashboardModuleCard from '@/components/dashboard/DashboardModuleCard'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import '../dashboard/dashboard-module-card.css'
import '../reportes-conducta/reportes-conducta.css'

const ICON_KINDER = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="3.2" />
    <path d="M5.5 19.5c.6-3.2 3.3-5.5 6.5-5.5s5.9 2.3 6.5 5.5" />
    <path d="M16.5 7.2c.9-.4 1.8-.4 2.6.1" />
  </svg>
)

const ICON_PRIMARIA = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19V7l8-4 8 4v12" />
    <path d="M9 19v-6h6v6" />
    <path d="M4 19h16" />
  </svg>
)

const ICON_SECUNDARIA = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
)

const NIVELES = [
  {
    id: 'kinder',
    label: 'Maternal / Kinder',
    desc: 'Maestras de español y teachers de inglés: capturan las boletas de sus grupos y las envían a dirección.',
    accent: 'sky' as const,
    kicker: 'Preescolar',
    tags: ['Español', 'Inglés', 'Grado y grupo'],
    icon: ICON_KINDER,
    ruta: '/boletas-captura/maternal-kinder',
  },
  {
    id: 'primaria',
    label: 'Primaria',
    desc: 'Maestras de español y teachers de inglés de 1° a 6°: capturan las boletas de sus grupos y las envían a dirección.',
    accent: 'indigo' as const,
    kicker: 'Primaria',
    tags: ['Español', 'Inglés', '1° a 6°'],
    icon: ICON_PRIMARIA,
    ruta: '/boletas-captura/primaria',
  },
  {
    id: 'secundaria',
    label: 'Secundaria',
    desc: 'Maestros: captura de calificaciones de sus materias y grupos.',
    accent: 'rose' as const,
    kicker: 'Secundaria',
    tags: ['Materias', 'Grupos'],
    icon: ICON_SECUNDARIA,
    ruta: '/boletas-secundaria',
  },
]

/** Enlace público para maestros y teachers: eligen su nivel y entran con su usuario o correo institucional. */
export default function BoletasCapturaHubPage() {
  const router = useRouter()

  return (
    <div className="dashboard-container dashboard-home reportes-conducta-page">
      <div className="dashboard-home-bg" aria-hidden="true" />
      <div className="dashboard-main">
        <div className="dashboard-heading reportes-heading facturacion-cfdi-heading">
          <button type="button" className="servicios-back-btn" onClick={() => router.push('/')}>
            <ArrowLeft size={16} aria-hidden />
            Inicio
          </button>
          <h1 className="dashboard-title">Captura de boletas</h1>
          <p className="dashboard-subtitle">
            Elige tu nivel. Después entra con tu usuario y contraseña o con tu correo institucional.
          </p>
          <div className="facturacion-cfdi-theme-row">
            <ThemeToggle />
          </div>
        </div>

        <div className="dashboard-nav-grid reportes-conducta-grid" role="list">
          {NIVELES.map((n, index) => (
            <div key={n.id} role="listitem">
              <DashboardModuleCard
                order={index + 1}
                label={n.label}
                desc={n.desc}
                accent={n.accent}
                icon={n.icon}
                kicker={n.kicker}
                tags={n.tags}
                onActivate={() => router.push(n.ruta)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

'use client'

import ThemeToggle from '@/components/ThemeToggle'
import DashboardModuleCard from '@/components/dashboard/DashboardModuleCard'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
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
    desc: 'Próximamente: captura de boletas por maestro y teacher.',
    accent: 'indigo' as const,
    kicker: 'Primaria',
    tags: ['Pronto'],
    icon: ICON_PRIMARIA,
    ruta: null,
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
  const [aviso, setAviso] = useState('')

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
          {aviso && (
            <p className="dashboard-subtitle" role="status">
              {aviso}
            </p>
          )}
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
                badge={n.ruta ? undefined : 'Pronto'}
                onActivate={() => {
                  if (n.ruta) router.push(n.ruta)
                  else setAviso('La captura de primaria en este portal se habilita pronto.')
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

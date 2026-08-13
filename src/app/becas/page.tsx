'use client'

import ThemeToggle from '@/components/ThemeToggle'
import ProtectedRoute from '@/components/ProtectedRoute'
import { BECAS_HUB_NAV, type BecasHubItem } from '@/lib/becasHubNav'
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  FilePlus2,
  KeyRound,
  RefreshCw,
  ScrollText,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

function HubIcon({ name }: { name: BecasHubItem['icon'] }) {
  const props = { size: 22, 'aria-hidden': true as const }
  switch (name) {
    case 'refresh':
      return <RefreshCw {...props} />
    case 'file-plus':
      return <FilePlus2 {...props} />
    case 'key':
      return <KeyRound {...props} />
    case 'scroll':
      return <ScrollText {...props} />
    case 'book':
      return <BookOpen {...props} />
    default:
      return <BookOpen {...props} />
  }
}

function ChevronRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function HubCard({ item }: { item: BecasHubItem }) {
  const body = (
    <>
      <div className="dash-nav-icon" aria-hidden>
        <HubIcon name={item.icon} />
      </div>
      <div className="dash-nav-body">
        <h2 className="dash-nav-title">{item.label}</h2>
        <p className="dash-nav-desc">{item.desc}</p>
      </div>
      <div className="dash-nav-arrow" aria-hidden>
        {item.external ? <ExternalLink size={16} /> : <ChevronRight />}
      </div>
    </>
  )

  if (item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className="dash-nav-item"
        data-accent={item.accent}
      >
        {body}
      </a>
    )
  }

  return (
    <Link href={item.path ?? '/becas'} className="dash-nav-item" data-accent={item.accent}>
      {body}
    </Link>
  )
}

function BecasHubView() {
  const router = useRouter()

  return (
    <div className="dashboard-container facturacion-cfdi-page becas-hub-page">
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
          <h1 className="dashboard-title">Becas</h1>
          <p className="dashboard-subtitle">
            Panel de Control Escolar: renovaciones, solicitudes y boletas de secundaria.
          </p>
          <div className="facturacion-cfdi-theme-row">
            <ThemeToggle />
          </div>
        </div>

        <div className="dashboard-nav-grid facturacion-cfdi-grid" role="list">
          {BECAS_HUB_NAV.map((item) => (
            <div key={item.id} role="listitem">
              <HubCard item={item} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function BecasHubPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <BecasHubView />
    </ProtectedRoute>
  )
}

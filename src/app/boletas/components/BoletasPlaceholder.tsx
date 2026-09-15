'use client'

import ThemeToggle from '@/components/ThemeToggle'
import { ArrowLeft, Construction } from 'lucide-react'
import { useRouter } from 'next/navigation'
import '../boletas-hub.css'
import './boletas-placeholder.css'

export type BoletasPlaceholderProps = {
  titulo: string
  nivel: string
  idioma: string
  resumen: string
}

export default function BoletasPlaceholder({
  titulo,
  nivel,
  idioma,
  resumen,
}: BoletasPlaceholderProps) {
  const router = useRouter()

  return (
    <div className="dashboard-container dashboard-home boletas-hub-page boletas-placeholder-page">
      <div className="dashboard-home-bg" aria-hidden="true" />
      <div className="boletas-hub-atmosphere" aria-hidden="true">
        <span className="boletas-hub-orb boletas-hub-orb--a" />
        <span className="boletas-hub-orb boletas-hub-orb--b" />
      </div>
      <div className="dashboard-main boletas-hub-main">
        <div className="dashboard-heading boletas-hub-heading">
          <button
            type="button"
            className="servicios-back-btn"
            onClick={() => router.push('/boletas')}
          >
            <ArrowLeft size={16} aria-hidden />
            Volver a boletas
          </button>
          <div className="facturacion-cfdi-theme-row" style={{ marginTop: '0.75rem' }}>
            <ThemeToggle />
          </div>
        </div>

        <section className="boletas-placeholder-card" aria-labelledby="boletas-ph-title">
          <div className="boletas-placeholder-icon" aria-hidden>
            <Construction size={28} />
          </div>
          <p className="boletas-hub-brand">
            {nivel} · {idioma}
          </p>
          <h1 id="boletas-ph-title">{titulo}</h1>
          <p className="boletas-placeholder-lead">{resumen}</p>
          <p className="boletas-placeholder-note">
            Este módulo forma parte del <strong>Sistema Integral de Boletas Escolares</strong>.
            La captura y el PDF se habilitarán aquí; por ahora Secundaria ya está disponible desde
            el hub.
          </p>
          <div className="boletas-placeholder-actions">
            <button type="button" className="boletas-placeholder-btn" onClick={() => router.push('/boletas')}>
              Ir al hub de boletas
            </button>
            <button
              type="button"
              className="boletas-placeholder-btn boletas-placeholder-btn--ghost"
              onClick={() => router.push('/boletas-secundaria')}
            >
              Abrir boletas de secundaria
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

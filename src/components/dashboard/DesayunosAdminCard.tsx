'use client'

import type { KeyboardEvent } from 'react'

const DESAYUNOS_TAGS = ['POS', 'Estancias', 'Comidas'] as const

function DesayunosIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 10h16v2.5a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V10z" />
      <path d="M7 10V7.5a2.5 2.5 0 0 1 5 0V10" />
      <path d="M19 10h1a2 2 0 0 1 0 4h-1" />
      <path d="M8 3.5v2" />
      <path d="M12 2.5v2.5" />
      <path d="M16 3.5v2" />
    </svg>
  )
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

type DesayunosAdminCardProps = {
  onActivate: () => void
}

export default function DesayunosAdminCard({ onActivate }: DesayunosAdminCardProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onActivate()
    }
  }

  return (
    <div
      className="dash-nav-item dash-nav-item--desayunos"
      data-accent="amber"
      onClick={onActivate}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Abrir Desayunos, Estancias y Comidas"
    >
      <div className="dash-desayunos-glow" aria-hidden />

      <div className="dash-desayunos-icon-wrap">
        <div className="dash-nav-icon dash-desayunos-icon">
          <DesayunosIcon />
        </div>
      </div>

      <div className="dash-nav-body dash-desayunos-body">
        <div className="dash-desayunos-meta">
          <span className="dash-desayunos-kicker">Punto de venta</span>
          <span className="dash-desayunos-badge">Módulo principal</span>
        </div>
        <h2 className="dash-nav-title dash-desayunos-title">Desayunos, Estancias y Comidas</h2>
        <p className="dash-nav-desc dash-desayunos-desc">
          Cobros, pedidos y control de alimentación escolar en un solo flujo operativo.
        </p>
        <ul className="dash-desayunos-tags" aria-label="Áreas del módulo">
          {DESAYUNOS_TAGS.map((tag) => (
            <li key={tag} className="dash-desayunos-tag">
              {tag}
            </li>
          ))}
        </ul>
      </div>

      <div className="dash-desayunos-action" aria-hidden>
        <span className="dash-desayunos-action-label">Entrar</span>
        <div className="dash-nav-arrow dash-desayunos-arrow">
          <ChevronRight />
        </div>
      </div>
    </div>
  )
}

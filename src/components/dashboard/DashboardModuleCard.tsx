'use client'

import type { KeyboardEvent, ReactNode } from 'react'

export type DashboardModuleAccent =
  | 'amber'
  | 'indigo'
  | 'violet'
  | 'rose'
  | 'emerald'
  | 'sky'

export type DashboardModuleCardProps = {
  label: string
  desc: string
  accent: DashboardModuleAccent
  icon: ReactNode
  kicker?: string
  badge?: string
  tags?: string[]
  featured?: boolean
  external?: boolean
  onActivate: () => void
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

export default function DashboardModuleCard({
  label,
  desc,
  accent,
  icon,
  kicker,
  badge,
  tags = [],
  featured = false,
  external = false,
  onActivate,
}: DashboardModuleCardProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onActivate()
    }
  }

  const actionLabel = external ? 'Abrir' : 'Entrar'

  return (
    <div
      className={`dash-nav-item dash-nav-item--module${featured ? ' dash-nav-item--featured' : ''}`}
      data-accent={accent}
      onClick={onActivate}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`${actionLabel}: ${label}`}
    >
      <div className="dash-module-glow" aria-hidden />

      <div className="dash-module-icon-wrap">
        <div className="dash-nav-icon dash-module-icon">{icon}</div>
      </div>

      <div className="dash-nav-body dash-module-body">
        {(kicker || badge || external) && (
          <div className="dash-module-meta">
            {kicker && <span className="dash-module-kicker">{kicker}</span>}
            {badge && <span className="dash-module-badge">{badge}</span>}
            {external && !badge && <span className="dash-module-badge dash-module-badge--external">Externo</span>}
          </div>
        )}
        <h2 className="dash-nav-title dash-module-title">{label}</h2>
        <p className="dash-nav-desc dash-module-desc">{desc}</p>
        {tags.length > 0 && (
          <ul className="dash-module-tags" aria-label="Áreas del módulo">
            {tags.map((tag) => (
              <li key={tag} className="dash-module-tag">
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="dash-module-action" aria-hidden>
        <span className="dash-module-action-label">{actionLabel}</span>
        <div className="dash-nav-arrow dash-module-arrow">
          <ChevronRight />
        </div>
      </div>
    </div>
  )
}

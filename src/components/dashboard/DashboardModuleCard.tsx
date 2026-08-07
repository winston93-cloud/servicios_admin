'use client'

import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { previewParaModulo } from '@/lib/dashboardModulePreviews'

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
  /** Número visible arriba a la izquierda (1-based). */
  order?: number
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
  order,
  kicker,
  badge,
  tags = [],
  featured = false,
  external = false,
  onActivate,
}: DashboardModuleCardProps) {
  const previewId = useId()
  const [previewing, setPreviewing] = useState(false)
  const preview = previewParaModulo(label, desc, tags)
  const actionLabel = external ? 'Abrir' : 'Entrar'

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onActivate()
    }
  }

  return (
    <div
      className={`dash-nav-item dash-nav-item--module${featured ? ' dash-nav-item--featured' : ''}${
        previewing ? ' is-previewing' : ''
      }`}
      data-accent={accent}
      onClick={onActivate}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setPreviewing(true)}
      onMouseLeave={() => setPreviewing(false)}
      onFocus={() => setPreviewing(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPreviewing(false)
        }
      }}
      aria-label={`${order != null ? `${order}. ` : ''}${actionLabel}: ${label}`}
      aria-describedby={previewId}
    >
      {order != null && (
        <span className="dash-module-order" aria-hidden>
          {order}
        </span>
      )}
      <div className="dash-module-glow" aria-hidden />
      <div className="dash-module-sheen" aria-hidden />

      <div className="dash-module-top">
        <div className="dash-module-icon-wrap">
          <div className="dash-nav-icon dash-module-icon">{icon}</div>
        </div>

        <div className="dash-nav-body dash-module-body">
          {(kicker || badge || external) && (
            <div className="dash-module-meta">
              {kicker && <span className="dash-module-kicker">{kicker}</span>}
              {badge && <span className="dash-module-badge">{badge}</span>}
              {external && !badge && (
                <span className="dash-module-badge dash-module-badge--external">Externo</span>
              )}
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

      <div
        id={previewId}
        className="dash-module-preview"
        aria-hidden={!previewing}
      >
        <div className="dash-module-preview-inner">
          <p className="dash-module-preview-kicker">Vista previa del sistema</p>
          <p className="dash-module-preview-synopsis">{preview.synopsis}</p>
          {preview.highlights.length > 0 && (
            <ul className="dash-module-preview-highlights">
              {preview.highlights.map((h) => (
                <li key={h}>
                  <span className="dash-module-preview-dot" aria-hidden />
                  {h}
                </li>
              ))}
            </ul>
          )}
          <div className="dash-module-preview-cta">
            <span>{external ? 'Abrir módulo externo' : 'Entrar al módulo'}</span>
            <span className="dash-module-preview-cta-arrow" aria-hidden>
              →
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

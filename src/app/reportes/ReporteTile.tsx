'use client'

import type { ReactNode } from 'react'
import { Copy, Download, ExternalLink } from 'lucide-react'
import type { ReporteAccent } from './reportesCatalog'
import type { ReporteMotor } from '@/lib/reportesCatalogData'

type ReporteTileProps = {
  id: string
  titulo: string
  meta: string
  descripcion: string
  accent: ReporteAccent
  motor?: ReporteMotor
  icon: ReactNode
  verHref: string
  verLabel?: string
  descargarHref?: string
  descargarLabel?: string
  copyUrl: string
  copiado: string | null
  onCopy: (id: string, url: string) => void
  extra?: ReactNode
  deshabilitado?: boolean
}

export default function ReporteTile({
  id,
  titulo,
  meta,
  descripcion,
  accent,
  motor,
  verHref,
  verLabel = 'Ver',
  descargarHref,
  descargarLabel = 'PDF',
  copyUrl,
  copiado,
  onCopy,
  extra,
  deshabilitado = false,
}: ReporteTileProps) {
  const motorLabel = motor === 'api-next' ? 'Nativo' : null

  return (
    <article
      className={`reporte-tile reporte-tile--${accent}${deshabilitado ? ' reporte-tile--disabled' : ''}`}
      title={descripcion}
    >
      <div className="reporte-tile-top">
        <h2 className="reporte-tile-title">{titulo}</h2>
        {motorLabel ? (
          <span className={`reporte-tile-badge reporte-tile-badge--${motor}`}>{motorLabel}</span>
        ) : null}
        <span className="reporte-tile-meta">{meta}</span>
      </div>

      <div className="reporte-tile-body">
        {extra ? <div className="reporte-tile-extra">{extra}</div> : null}
        <div className="reporte-tile-foot">
          <a
            className={`reporte-tile-btn reporte-tile-btn--main reporte-tile-btn--${accent}`}
            href={verHref}
            target={deshabilitado ? undefined : '_blank'}
            rel={deshabilitado ? undefined : 'noopener noreferrer'}
            aria-disabled={deshabilitado}
            onClick={deshabilitado ? (e) => e.preventDefault() : undefined}
          >
            <ExternalLink size={11} aria-hidden />
            {verLabel}
          </a>
          {descargarHref ? (
            <a
              className="reporte-tile-btn"
              href={descargarHref}
              target="_blank"
              rel="noopener noreferrer"
              title={descargarLabel}
            >
              <Download size={11} aria-hidden />
              {descargarLabel}
            </a>
          ) : null}
          <button
            type="button"
            className="reporte-tile-btn reporte-tile-btn--ghost"
            title="Copiar URL"
            onClick={() => onCopy(id, copyUrl)}
          >
            <Copy size={11} aria-hidden />
            {copiado === id ? 'OK' : 'URL'}
          </button>
        </div>
      </div>
    </article>
  )
}

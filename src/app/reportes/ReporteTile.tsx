'use client'

import type { ReactNode } from 'react'
import { Copy, Download, ExternalLink } from 'lucide-react'
import type { ReporteAccent } from './reportesCatalog'

type ReporteTileProps = {
  id: string
  titulo: string
  meta: string
  descripcion: string
  accent: ReporteAccent
  icon: ReactNode
  verHref: string
  verLabel?: string
  descargarHref?: string
  descargarLabel?: string
  copyUrl: string
  copiado: string | null
  onCopy: (id: string, url: string) => void
  extra?: ReactNode
}

export default function ReporteTile({
  id,
  titulo,
  meta,
  descripcion,
  accent,
  icon,
  verHref,
  verLabel = 'Ver',
  descargarHref,
  descargarLabel = 'PDF',
  copyUrl,
  copiado,
  onCopy,
  extra,
}: ReporteTileProps) {
  return (
    <article className={`reporte-tile reporte-tile--${accent}`}>
      <div className="reporte-tile-head">
        <div className={`reporte-tile-icon reporte-tile-icon--${accent}`} aria-hidden>
          {icon ?? <ExternalLink size={16} />}
        </div>
        <div className="reporte-tile-head-text">
          <h2 className="reporte-tile-title">{titulo}</h2>
          <p className="reporte-tile-meta">{meta}</p>
        </div>
      </div>

      <p className="reporte-tile-desc">{descripcion}</p>

      {extra ? <div className="reporte-tile-extra">{extra}</div> : null}

      <div className="reporte-tile-foot">
        <a
          className={`reporte-tile-btn reporte-tile-btn--main reporte-tile-btn--${accent}`}
          href={verHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={13} aria-hidden />
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
            <Download size={13} aria-hidden />
            {descargarLabel}
          </a>
        ) : null}
        <button
          type="button"
          className="reporte-tile-btn reporte-tile-btn--ghost"
          title="Copiar URL"
          onClick={() => onCopy(id, copyUrl)}
        >
          <Copy size={13} aria-hidden />
          {copiado === id ? 'OK' : 'URL'}
        </button>
      </div>
    </article>
  )
}

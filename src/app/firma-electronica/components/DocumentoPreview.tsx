'use client'

/**
 * 2026-08-21 - Preview del documento en canvas.
 * 2026-08-22 - Tocar el PDF hace lo mismo que «Abrir PDF»: visor nativo (zoom) en otra pestaña.
 */
import dynamic from 'next/dynamic'
import { ExternalLink } from 'lucide-react'

const PdfInlineViewer = dynamic(() => import('./PdfInlineViewer'), {
  ssr: false,
  loading: () => (
    <p className="fe-doc-empty" aria-live="polite">
      Cargando documento…
    </p>
  ),
})

type Props = {
  title: string
  url: string | null
  emptyLabel?: string
}

export default function DocumentoPreview({ title, url, emptyLabel }: Props) {
  return (
    <section className="fe-doc-card" aria-label={title}>
      <header className="fe-doc-head">
        <h2>{title}</h2>
        {url ? (
          <a
            className="fe-doc-open"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={14} aria-hidden />
            Abrir PDF
          </a>
        ) : null}
      </header>
      <div className={`fe-doc-frame${url ? ' fe-doc-frame--openable' : ''}`}>
        {url ? (
          <a
            className="fe-doc-doclink"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir ${title} en el visor del dispositivo para hacer zoom`}
          >
            <PdfInlineViewer url={url} title={title} />
            <span className="fe-doc-hit-hint">
              Toca el documento para abrirlo y hacer zoom
            </span>
          </a>
        ) : (
          <p className="fe-doc-empty">
            {emptyLabel || 'El documento aparecerá aquí.'}
          </p>
        )}
      </div>
    </section>
  )
}

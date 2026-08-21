'use client'

/**
 * 2026-08-21 - Preview del documento: canvas PDF (móvil/Safari) + enlace de descarga.
 */
import dynamic from 'next/dynamic'

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
            download={`carta-beca-${Date.now()}.pdf`}
          >
            Abrir PDF
          </a>
        ) : null}
      </header>
      <div className="fe-doc-frame">
        {url ? (
          <PdfInlineViewer url={url} title={title} />
        ) : (
          <p className="fe-doc-empty">
            {emptyLabel || 'El documento aparecerá aquí.'}
          </p>
        )}
      </div>
    </section>
  )
}

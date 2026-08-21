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
  /** URL pública .pdf (para abrir/descargar con extensión visible). */
  pdfHref?: string | null
  emptyLabel?: string
}

export default function DocumentoPreview({
  title,
  url,
  pdfHref,
  emptyLabel,
}: Props) {
  const openHref = pdfHref || url
  return (
    <section className="fe-doc-card" aria-label={title}>
      <header className="fe-doc-head">
        <h2>{title}</h2>
        {openHref ? (
          <a
            className="fe-doc-open"
            href={openHref}
            target="_blank"
            rel="noopener noreferrer"
            download={
              pdfHref
                ? pdfHref.split('/').pop() || 'documento.pdf'
                : `documento-${Date.now()}.pdf`
            }
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

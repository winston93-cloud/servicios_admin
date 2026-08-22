'use client'

/**
 * 2026-08-21 - Preview del documento en canvas.
 * 2026-08-22 - Clic en el PDF o en el botón abre visor a pantalla completa (zoom, sin descargar).
 */
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Maximize2 } from 'lucide-react'

const PdfInlineViewer = dynamic(() => import('./PdfInlineViewer'), {
  ssr: false,
  loading: () => (
    <p className="fe-doc-empty" aria-live="polite">
      Cargando documento…
    </p>
  ),
})

const PdfLightbox = dynamic(() => import('./PdfLightbox'), { ssr: false })

type Props = {
  title: string
  url: string | null
  emptyLabel?: string
}

export default function DocumentoPreview({ title, url, emptyLabel }: Props) {
  const [visor, setVisor] = useState(false)

  return (
    <section className="fe-doc-card" aria-label={title}>
      <header className="fe-doc-head">
        <h2>{title}</h2>
        {url ? (
          <button
            type="button"
            className="fe-doc-open"
            onClick={() => setVisor(true)}
          >
            <Maximize2 size={14} aria-hidden />
            Ver a pantalla completa
          </button>
        ) : null}
      </header>
      <div className={`fe-doc-frame${url ? ' fe-doc-frame--openable' : ''}`}>
        {url ? (
          <>
            <PdfInlineViewer url={url} title={title} />
            <button
              type="button"
              className="fe-doc-hit"
              onClick={() => setVisor(true)}
              aria-label={`Abrir ${title} a pantalla completa para ver y hacer zoom`}
            />
            <p className="fe-doc-hit-hint">
              Toca el documento para verlo en grande y hacer zoom
            </p>
          </>
        ) : (
          <p className="fe-doc-empty">
            {emptyLabel || 'El documento aparecerá aquí.'}
          </p>
        )}
      </div>
      {url ? (
        <PdfLightbox
          open={visor}
          url={url}
          title={title}
          onClose={() => setVisor(false)}
        />
      ) : null}
    </section>
  )
}

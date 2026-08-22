'use client'

/**
 * 2026-08-21 - Preview del documento en canvas.
 * 2026-08-22 - Tocar abre visor en la página; X / Cerrar para salir.
 */
import { useRef, useState, type PointerEvent } from 'react'
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
  const tapRef = useRef<{ x: number; y: number } | null>(null)

  function abrir() {
    if (url) setVisor(true)
  }

  function onPointerDown(e: PointerEvent) {
    tapRef.current = { x: e.clientX, y: e.clientY }
  }

  function onPointerUp(e: PointerEvent) {
    const start = tapRef.current
    tapRef.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.hypot(dx, dy) < 12) abrir()
  }

  return (
    <section className="fe-doc-card" aria-label={title}>
      <header className="fe-doc-head">
        <h2>{title}</h2>
        {url ? (
          <button type="button" className="fe-doc-open" onClick={abrir}>
            <Maximize2 size={14} aria-hidden />
            Abrir PDF
          </button>
        ) : null}
      </header>
      <div
        className={`fe-doc-frame${url ? ' fe-doc-frame--openable' : ''}`}
        onPointerDown={url ? onPointerDown : undefined}
        onPointerUp={url ? onPointerUp : undefined}
      >
        {url ? (
          <>
            <PdfInlineViewer url={url} title={title} />
            <p className="fe-doc-hit-hint">
              Toca el documento para abrirlo · usa Cerrar (X) al terminar
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

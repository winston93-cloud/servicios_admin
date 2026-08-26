'use client'

/**
 * Preview del documento en canvas (pdf.js).
 * Móvil: tocar abre pantalla completa. Escritorio: solo botones (evita abrir al hacer scroll).
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import dynamic from 'next/dynamic'
import { Download, Maximize2 } from 'lucide-react'

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
  /** Nombre del archivo al descargar (p. ej. carta-aceptacion-beca-firmada.pdf). */
  downloadFileName?: string
}

export default function DocumentoPreview({
  title,
  url,
  emptyLabel,
  downloadFileName = 'documento.pdf',
}: Props) {
  const [visor, setVisor] = useState(false)
  const [esEscritorio, setEsEscritorio] = useState(false)
  const tapRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const sync = () => setEsEscritorio(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const abrir = useCallback(() => {
    if (url) setVisor(true)
  }, [url])

  const descargar = useCallback(() => {
    if (!url) return
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = downloadFileName
    enlace.rel = 'noopener'
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
  }, [url, downloadFileName])

  function onPointerDown(e: PointerEvent) {
    if (esEscritorio) return
    tapRef.current = { x: e.clientX, y: e.clientY }
  }

  function onPointerUp(e: PointerEvent) {
    if (esEscritorio) return
    const start = tapRef.current
    tapRef.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.hypot(dx, dy) < 12) abrir()
  }

  const tapAbre = Boolean(url) && !esEscritorio

  return (
    <section className="fe-doc-card" aria-label={title}>
      <header className="fe-doc-head">
        <h2>{title}</h2>
        {url ? (
          <div className="fe-doc-actions" role="group" aria-label="Acciones del PDF">
            <button
              type="button"
              className="fe-doc-open fe-doc-open--download"
              onClick={descargar}
            >
              <Download size={14} aria-hidden />
              Descargar PDF
            </button>
            <button type="button" className="fe-doc-open" onClick={abrir}>
              <Maximize2 size={14} aria-hidden />
              Pantalla completa
            </button>
          </div>
        ) : null}
      </header>
      <div
        className={`fe-doc-frame${tapAbre ? ' fe-doc-frame--openable' : ''}`}
        onPointerDown={tapAbre ? onPointerDown : undefined}
        onPointerUp={tapAbre ? onPointerUp : undefined}
      >
        {url ? (
          <>
            <PdfInlineViewer url={url} title={title} />
            <p className="fe-doc-hit-hint fe-doc-hit-hint--mobile">
              Toca el documento para pantalla completa · Descarga con el botón de arriba
            </p>
            <p className="fe-doc-hit-hint fe-doc-hit-hint--desktop">
              Revisa el PDF aquí. Usa <strong>Descargar PDF</strong> para guardar una copia o{' '}
              <strong>Pantalla completa</strong> para ampliar.
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
          downloadFileName={downloadFileName}
          onClose={() => setVisor(false)}
        />
      ) : null}
    </section>
  )
}

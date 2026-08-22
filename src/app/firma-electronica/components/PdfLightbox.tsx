'use client'

/**
 * 2026-08-22 - Visor PDF en la página: zoom y X para cerrar (móvil y escritorio).
 */
import { useCallback, useEffect, useState } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import PdfInlineViewer from './PdfInlineViewer'

type Props = {
  open: boolean
  url: string
  title: string
  onClose: () => void
}

const ZOOM_MIN = 0.75
const ZOOM_MAX = 2.5
const ZOOM_STEP = 0.25

export default function PdfLightbox({ open, url, title, onClose }: Props) {
  const [zoom, setZoom] = useState(1)

  const clampZoom = useCallback((n: number) => {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(n * 100) / 100))
  }, [])

  useEffect(() => {
    if (!open) return
    setZoom(1)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fe-lb" role="dialog" aria-modal="true" aria-labelledby="fe-lb-title">
      <div className="fe-lb-panel">
        <header className="fe-lb-bar">
          <p id="fe-lb-title" className="fe-lb-title">
            {title}
          </p>
          <div className="fe-lb-zoom" role="group" aria-label="Zoom">
            <button
              type="button"
              className="fe-lb-icon"
              onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
              disabled={zoom <= ZOOM_MIN}
              aria-label="Alejar"
            >
              <Minus size={18} aria-hidden />
            </button>
            <span className="fe-lb-zoom-val">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="fe-lb-icon"
              onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
              disabled={zoom >= ZOOM_MAX}
              aria-label="Acercar"
            >
              <Plus size={18} aria-hidden />
            </button>
          </div>
          <button
            type="button"
            className="fe-lb-close"
            onClick={onClose}
            aria-label="Cerrar documento"
          >
            <X size={20} aria-hidden />
            Cerrar
          </button>
        </header>
        <div className="fe-lb-body">
          <PdfInlineViewer url={url} title={title} zoom={zoom} />
        </div>
      </div>
    </div>
  )
}

'use client'

/**
 * 2026-08-22 - PDF a pantalla completa con zoom, sin descargar.
 */
import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react'
import { Maximize2, Minus, Plus, X } from 'lucide-react'
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
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null)

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
      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        setZoom((z) => clampZoom(z + ZOOM_STEP))
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        setZoom((z) => clampZoom(z - ZOOM_STEP))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, clampZoom])

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 2) return
    const [a, b] = [e.touches[0], e.touches[1]]
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    pinchRef.current = { dist, zoom }
  }

  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length !== 2 || !pinchRef.current) return
    e.preventDefault()
    const [a, b] = [e.touches[0], e.touches[1]]
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    const next = pinchRef.current.zoom * (dist / pinchRef.current.dist)
    setZoom(clampZoom(next))
  }

  const onTouchEnd = () => {
    pinchRef.current = null
  }

  if (!open) return null

  return (
    <div
      className="fe-lb"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fe-lb-title"
      onClick={onClose}
    >
      <div
        className="fe-lb-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="fe-lb-bar">
          <p id="fe-lb-title" className="fe-lb-title">
            <Maximize2 size={16} aria-hidden />
            {title}
          </p>
          <div className="fe-lb-zoom" role="group" aria-label="Zoom del documento">
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
            className="fe-lb-icon fe-lb-close"
            onClick={onClose}
            aria-label="Cerrar visor"
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        <div
          className="fe-lb-body"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <PdfInlineViewer url={url} title={title} zoom={zoom} />
        </div>
      </div>
    </div>
  )
}
